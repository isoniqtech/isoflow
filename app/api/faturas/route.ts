import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"
import { sendInvoiceToERP } from "@/lib/toconline/send-fc"
import {
  matchCreditNoteToInvoice,
  matchPendingCreditNotesToInvoice,
} from "@/lib/utils/credit-note-match"
import { autoSendCreditNoteIfEnabled } from "@/lib/toconline/send-ncf"

/**
 * Auto-cria a FC no ERP se o tenant tiver auto_erp_send ativo. So' faz algo com
 * a flag ligada - com ela desligada a FC cria-se manualmente. Cria via
 * sendInvoiceToERP (app -> TOConline direto ou proxy n8n), sem forward ao webhook.
 */
async function autoSendToERP(invoiceId: string, tenantId: string) {
  try {
    const admin = createAdminClient()
    const { data: tenant } = await admin
      .from("tenants")
      .select("auto_erp_send")
      .eq("id", tenantId)
      .maybeSingle()
    if (!tenant?.auto_erp_send) return
    await sendInvoiceToERP(tenantId, invoiceId)
  } catch (e) {
    console.warn("auto ERP send failed:", e)
  }
}

const invoiceInputSchema = z.object({
  type: z.enum(["incoming", "outgoing"]).default("incoming"),
  project_id: z.string().uuid().optional().nullable(),
  supplier_name: z.string().trim().min(1).max(200).optional().nullable(),
  supplier_nif: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "NIF deve ter 9 dígitos")
    .optional()
    .nullable(),
  supplier_email: z.string().email().optional().nullable(),
  supplier_address: z.string().trim().max(500).optional().nullable(),
  invoice_number: z.string().trim().max(100).optional().nullable(),
  invoice_date: z.string().date().optional().nullable(),
  due_date: z.string().date().optional().nullable(),
  subtotal: z.number().nonnegative().optional().nullable(),
  vat_rate: z.number().min(0).max(100).optional().nullable(),
  vat_amount: z.number().nonnegative().optional().nullable(),
  total: z.number().positive().max(999_999_999).optional().nullable(),
  currency: z.string().length(3).default("EUR"),
  description: z.string().trim().max(500).optional().nullable(),
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
    .optional()
    .nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  needs_review: z.boolean().default(false),
  // Tipo de documento: fatura (FC) ou nota de credito de fornecedor (NCF). Ver migration 047.
  document_kind: z.enum(["invoice", "credit_note"]).default("invoice"),
  // So relevante em notas de credito: numero da fatura original que a NCF credita.
  referenced_document_number: z.string().trim().max(100).optional().nullable(),
})

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "view_own")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (ctx.role === "member") {
    query = query.eq("created_by", ctx.userId)
  }

  const { data, error } = await query
  if (error) return jsonError("Database error", 500, error.message)
  return Response.json({ data })
}

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "create")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = invoiceInputSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const supabase = createClient()
  const input = parsed.data

  if (input.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.project_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle()
    if (!project) {
      return jsonError("Project does not exist or is not in this tenant", 400)
    }
  }

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      tenant_id: ctx.tenantId,
      type: input.type,
      status: "pending",
      source: "manual",
      project_id: input.project_id ?? null,
      supplier_name: input.supplier_name ?? null,
      supplier_nif: input.supplier_nif ?? null,
      supplier_email: input.supplier_email ?? null,
      supplier_address: input.supplier_address ?? null,
      invoice_number: input.invoice_number ?? null,
      invoice_date: input.invoice_date ?? null,
      due_date: input.due_date ?? null,
      subtotal: input.subtotal ?? null,
      vat_rate: input.vat_rate ?? null,
      vat_amount: input.vat_amount ?? null,
      total: input.total ?? null,
      currency: input.currency,
      description: input.description ?? null,
      category: input.category ?? null,
      notes: input.notes ?? null,
      needs_review: input.needs_review,
      document_kind: input.document_kind,
      referenced_document_number: input.referenced_document_number ?? null,
      created_by: ctx.userId,
    })
    .select("*")
    .single()

  if (insertError) {
    console.error("POST /api/faturas insert failed:", insertError)
    return jsonError("Could not create invoice", 500, insertError.message)
  }

  await log(supabase, {
    action: "invoice.created",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "invoice",
    resourceId: invoice.id,
    metadata: {
      supplier: invoice.supplier_name,
      total: invoice.total,
    },
  })

  // Matching FC<->NCF dentro da app (nao bloqueia a criacao)
  try {
    if (invoice.document_kind === "credit_note") {
      await matchCreditNoteToInvoice(supabase, invoice)
    } else {
      await matchPendingCreditNotesToInvoice(supabase, invoice)
    }
  } catch (e) {
    console.warn("credit-note match (manual upload) failed:", e)
  }

  // Auto-envio ao ERP so' com a flag auto_erp_send ligada e fatura sem revisao.
  // (Ja' NAO ha' forward incondicional ao n8n na criacao: a FC so' se cria com a
  // flag, ou manualmente pelo botao. Assim erp_synced/estado ficam fiaveis.)
  if (!invoice.needs_review && invoice.type === "incoming") {
    if (invoice.document_kind === "credit_note") {
      // Caminho NCF isolado (independente do FC - Opcao A).
      void autoSendCreditNoteIfEnabled(ctx.tenantId, invoice.id)
    } else {
      void autoSendToERP(invoice.id, ctx.tenantId)
    }
  }

  return Response.json({ data: invoice }, { status: 201 })
}
