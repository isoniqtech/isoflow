import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"
import { PRE_ERP_STATUSES } from "@/lib/utils/invoice-status"

const invoiceUpdateSchema = z
  .object({
    project_id: z.string().uuid().nullable(),
    status: z.enum([
      "em_sistema",
      "necessita_revisao",
      "enviada_erp",
      "rejected",
      "duplicate",
      "pending",
      "processing",
      "matched",
      "paid",
      "reconciled",
    ]),
    supplier_name: z.string().trim().max(200).nullable(),
    supplier_nif: z
      .string()
      .trim()
      .regex(/^\d{9}$/, "NIF deve ter 9 dígitos")
      .nullable(),
    supplier_email: z.string().email().nullable(),
    supplier_address: z.string().trim().max(500).nullable(),
    invoice_number: z.string().trim().max(100).nullable(),
    invoice_date: z.string().date().nullable(),
    due_date: z.string().date().nullable(),
    subtotal: z.number().nonnegative().nullable(),
    vat_rate: z.number().min(0).max(100).nullable(),
    vat_amount: z.number().nonnegative().nullable(),
    total: z.number().positive().max(999_999_999).nullable(),
    currency: z.string().length(3),
    description: z.string().trim().max(500).nullable(),
    category: z
      .enum([
        "transporte",
        "alimentacao",
        "tecnologia",
        "servicos",
        "material",
        "combustivel",
        "comunicacoes",
        "alojamento",
        "formacao",
        "outro",
      ])
      .nullable(),
    notes: z.string().trim().max(2000).nullable(),
    expense_category_code: z.string().trim().max(32).nullable(),
    needs_review: z.boolean(),
    // Notas de credito (NCF). Reclassificar so antes do envio ao ERP.
    document_kind: z.enum(["invoice", "credit_note"]),
    related_invoice_id: z.string().uuid().nullable(),
    referenced_document_number: z.string().trim().max(100).nullable(),
  })
  .partial()

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "view_own")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)

  if (ctx.role === "member") {
    query = query.eq("created_by", ctx.userId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) return jsonError("Database error", 500, error.message)
  if (!data) return jsonError("Not found", 404)
  return Response.json({ data })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "edit")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = invoiceUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const supabase = createClient()

  // Campos que nao podem mudar depois de a fatura/NCF ir para o ERP: o documento
  // ja' esta' lancado na contabilidade e mudar aqui criaria divergencia.
  const locksAfterErp = "expense_category_code" in parsed.data || "document_kind" in parsed.data
  if (locksAfterErp) {
    const { data: atual } = await supabase
      .from("invoices")
      .select("status, toconline_fc_id")
      .eq("id", params.id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle()

    // So' bloqueia quando a FC EXISTE mesmo no ERP: ha' toconline_fc_id
    // (confirmado pelo /update-fc no n8n, ou criado no modo direto) ou o estado
    // ja' passou o pre-ERP. NAO basta erp_synced: no modo n8n isso e' so'
    // "enviado ao webhook", nao "FC criada" - e deixava faturas sem FC com a
    // categoria bloqueada (RNE 503508225 etc).
    const row = atual as { status?: string | null; toconline_fc_id?: string | null } | null
    const jaEnviada =
      Boolean(row?.toconline_fc_id) ||
      (!!row?.status && !(PRE_ERP_STATUSES as readonly string[]).includes(row.status))

    if (jaEnviada) {
      const campo =
        "document_kind" in parsed.data
          ? "o tipo de documento (fatura/nota de credito)"
          : "a categoria de gasto"
      return jsonError(
        `Documento ja enviado para o ERP: ${campo} nao pode ser alterado`,
        409,
      )
    }
  }

  // Associar manualmente a uma fatura original: validar que existe e e' do tenant.
  if (parsed.data.related_invoice_id) {
    const { data: original } = await supabase
      .from("invoices")
      .select("id")
      .eq("id", parsed.data.related_invoice_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle()
    if (!original) {
      return jsonError("A fatura a associar nao existe neste tenant", 400)
    }
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .select("*")
    .maybeSingle()

  if (error) return jsonError("Could not update invoice", 500, error.message)
  if (!data) return jsonError("Not found", 404)

  await log(supabase, {
    action: "invoice.updated",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "invoice",
    resourceId: data.id,
    metadata: { changed_keys: Object.keys(parsed.data) },
  })

  return Response.json({ data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "delete")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("email_message_id")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .single()

  // Limpar referencias que bloqueiam o delete (FKs NO ACTION, migracoes 007/008):
  //  - reconciliations.invoice_id e' NOT NULL -> apagar a conciliacao
  //  - bank_transactions.invoice_id -> desassociar (SET NULL manual)
  // (efatura_documents.invoice_id e invoices.related_invoice_id sao ON DELETE
  //  SET NULL, tratados automaticamente pela BD.)
  await supabase
    .from("reconciliations")
    .delete()
    .eq("invoice_id", params.id)
    .eq("tenant_id", ctx.tenantId)
  await supabase
    .from("bank_transactions")
    .update({ invoice_id: null })
    .eq("invoice_id", params.id)
    .eq("tenant_id", ctx.tenantId)

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)

  if (error) return jsonError("Could not delete invoice", 500, error.message)

  if (invoice?.email_message_id) {
    await supabase
      .from("email_processing_log")
      .delete()
      .eq("tenant_id", ctx.tenantId)
      .eq("email_message_id", invoice.email_message_id)
  }

  await log(supabase, {
    action: "invoice.deleted",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "invoice",
    resourceId: params.id,
  })

  return Response.json({ ok: true })
}
