import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasPermission } from "@/lib/utils/permissions"
import { getValidToken } from "@/lib/toconline/token"
import { createDirectFC } from "@/lib/toconline/fc"

const bodySchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(50),
})

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(session.role, "faturas", "edit"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const supabase = createClient()
  const tenantId = session.tenant.id

  // Ler modo de integracao do tenant
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("integration_mode")
    .eq("id", tenantId)
    .maybeSingle()

  const integrationMode = (tenantRow as { integration_mode?: string } | null)?.integration_mode ?? "n8n"

  // Buscar faturas elegíveis
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, supplier_name, supplier_nif, invoice_number, invoice_date, subtotal, vat_rate, vat_amount, total, description, currency, toconline_fc_id, bank_transaction_id")
    .eq("tenant_id", tenantId)
    .in("id", parsed.data.invoice_ids)

  if (error || !invoices?.length)
    return NextResponse.json({ error: "Faturas nao encontradas" }, { status: 404 })

  const pending = invoices.filter((inv) => !inv.toconline_fc_id)
  const alreadyDone = invoices.length - pending.length

  if (!pending.length)
    return NextResponse.json({ queued: 0, skipped: alreadyDone })

  // Notas dos movimentos bancarios conciliados (para anexar ao FC no TOConline)
  const bankTxIds = pending
    .map((inv) => inv.bank_transaction_id)
    .filter((v): v is string => Boolean(v))
  const noteByTxId = new Map<string, string>()
  if (bankTxIds.length) {
    const { data: txNotes } = await supabase
      .from("bank_transactions")
      .select("id, notes")
      .eq("tenant_id", tenantId)
      .in("id", bankTxIds)
    for (const t of txNotes ?? []) {
      if (t.notes && t.notes.trim().length > 0) noteByTxId.set(t.id, t.notes)
    }
  }
  const noteForInvoice = (inv: { bank_transaction_id: string | null }): string | null =>
    inv.bank_transaction_id ? noteByTxId.get(inv.bank_transaction_id) ?? null : null

  // -------------------------------------------------------------------
  // MODO DIRETO: cria FC directamente no TOConline sem passar pelo n8n
  // -------------------------------------------------------------------
  if (integrationMode === "toconline_direct") {
    let tokenConfig: Awaited<ReturnType<typeof getValidToken>>
    try {
      tokenConfig = await getValidToken(tenantId)
    } catch (e) {
      return NextResponse.json(
        { error: `TOConline nao disponivel: ${e instanceof Error ? e.message : String(e)}` },
        { status: 503 },
      )
    }

    // Categoria de gasto configurada pelo tenant (fallback: default do fc.ts)
    const { data: erpRow } = await supabase
      .from("tenant_integrations")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("type", "erp")
      .eq("provider", "toconline")
      .maybeSingle()
    const expenseCategoryCode =
      (erpRow?.config as { default_expense_category?: string } | null)?.default_expense_category ?? null

    const admin = createAdminClient()
    const now = new Date().toISOString()
    const errors: string[] = []
    let created = 0
    let skipped = alreadyDone

    await Promise.all(
      pending.map(async (inv) => {
        try {
          const result = await createDirectFC(tokenConfig.accessToken, tokenConfig.appBase, tokenConfig.apiBase, {
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            invoiceDate: inv.invoice_date,
            supplierNif: inv.supplier_nif,
            supplierName: inv.supplier_name,
            subtotal: inv.subtotal !== null ? Number(inv.subtotal) : null,
            description: inv.description,
            movementNote: noteForInvoice(inv),
            vatRate: inv.vat_rate !== null ? Number(inv.vat_rate) : null,
            expenseCategoryCode,
          })

          // Gravar fc_number directamente - mesma logica que /api/faturas/[id]/update-fc
          await admin
            .from("invoices")
            .update({
              toconline_fc_id: result.fcNumber,
              erp_synced: true,
              erp_synced_at: now,
              updated_at: now,
            })
            .eq("id", inv.id)
            .eq("tenant_id", tenantId)

          if (result.alreadyExisted) {
            skipped++
          } else {
            created++
          }
        } catch (e) {
          errors.push(
            `${inv.invoice_number ?? inv.id}: ${e instanceof Error ? e.message : String(e)}`,
          )
        }
      }),
    )

    return NextResponse.json({ queued: created, skipped, errors })
  }

  // -------------------------------------------------------------------
  // MODO N8N: comportamento original intocado
  // O n8n recebe o payload e chama /api/faturas/[id]/update-fc de volta.
  // -------------------------------------------------------------------

  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("provider", "n8n")
    .eq("is_active", true)
    .maybeSingle()

  const n8nUrl = (integration?.config as { url?: string } | null)?.url || process.env.N8N_WEBHOOK_URL
  if (!n8nUrl)
    return NextResponse.json({ error: "Integracao ERP nao configurada" }, { status: 503 })

  const cronSecret = process.env.CRON_SECRET ?? ""
  const errors: string[] = []

  await Promise.all(
    pending.map(async (inv) => {
      try {
        const res = await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            callback_secret: cronSecret,
            invoice: {
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
              movement_note: noteForInvoice(inv),
            },
          }),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => "")
          errors.push(`${inv.invoice_number ?? inv.id}: HTTP ${res.status} ${text.slice(0, 200)}`)
        }
      } catch (e) {
        errors.push(`${inv.invoice_number ?? inv.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }),
  )

  const queued = pending.length - errors.length
  return NextResponse.json({ queued, skipped: alreadyDone, errors })
}
