import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"

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

  // A categoria de gasto nao pode mudar depois de a fatura ir para o ERP: o
  // documento ja' esta' lancado na contabilidade e mudar aqui criaria divergencia.
  if ("expense_category_code" in parsed.data) {
    const { data: atual } = await supabase
      .from("invoices")
      .select("erp_synced, toconline_fc_id")
      .eq("id", params.id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle()

    const jaEnviada =
      Boolean(atual?.erp_synced) ||
      Boolean((atual as { toconline_fc_id?: string | null } | null)?.toconline_fc_id)

    if (jaEnviada) {
      return jsonError(
        "Fatura ja enviada para o ERP: a categoria de gasto nao pode ser alterada",
        409,
      )
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
