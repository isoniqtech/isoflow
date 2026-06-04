import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"
import { forwardInvoiceToN8N } from "@/lib/webhooks/n8n"

async function autoSendToERP(invoiceId: string, tenantId: string) {
  try {
    const admin = createAdminClient()

    const { data: tenant } = await admin
      .from("tenants")
      .select("auto_erp_send")
      .eq("id", tenantId)
      .maybeSingle()

    if (!tenant?.auto_erp_send) return

    const { data: integration } = await admin
      .from("tenant_integrations")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("type", "erp")
      .eq("provider", "n8n")
      .eq("is_active", true)
      .maybeSingle()

    const n8nUrl = (integration?.config as { url?: string } | null)?.url || process.env.N8N_WEBHOOK_URL
    if (!n8nUrl) return

    const { data: inv } = await admin
      .from("invoices")
      .select("id, supplier_name, supplier_nif, invoice_number, invoice_date, subtotal, vat_rate, vat_amount, total, description, currency, toconline_fc_id")
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (!inv || inv.toconline_fc_id) return // já enviada

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://isoflow-seven.vercel.app"
    const cronSecret = process.env.CRON_SECRET ?? ""

    await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        callback_url: `${appUrl}/api/faturas`,
        callback_secret: cronSecret,
        invoices: [{
          id: inv.id,
          supplier_name: inv.supplier_name,
          supplier_nif: inv.supplier_nif,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          subtotal: inv.subtotal,
          vat_rate: inv.vat_rate,
          vat_amount: inv.vat_amount,
          total: inv.total,
          description: inv.description,
          currency: inv.currency ?? "EUR",
        }],
        auto_sent: true,
      }),
    }).catch(() => null)
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

  // n8n forwarder (fire-and-forget — não bloqueia a resposta da API)
  try {
    const admin = createAdminClient()
    void forwardInvoiceToN8N(admin, invoice.id, ctx.tenantId)
  } catch (e) {
    console.warn("n8n forward (manual upload) failed:", e)
  }

  // Auto-send ao ERP se tenant tiver a opção activada e fatura não precisar revisão
  if (!invoice.needs_review && invoice.type === "incoming") {
    void autoSendToERP(invoice.id, ctx.tenantId)
  }

  return Response.json({ data: invoice }, { status: 201 })
}
