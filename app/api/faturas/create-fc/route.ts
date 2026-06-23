import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"

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

  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", session.tenant.id)
    .eq("type", "erp")
    .eq("provider", "n8n")
    .eq("is_active", true)
    .maybeSingle()

  const n8nUrl = (integration?.config as { url?: string } | null)?.url || process.env.N8N_WEBHOOK_URL
  if (!n8nUrl)
    return NextResponse.json({ error: "Integração ERP não configurada" }, { status: 503 })

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, supplier_name, supplier_nif, invoice_number, invoice_date, subtotal, vat_rate, vat_amount, total, description, currency, toconline_fc_id")
    .eq("tenant_id", session.tenant.id)
    .in("id", parsed.data.invoice_ids)

  if (error || !invoices?.length)
    return NextResponse.json({ error: "Faturas não encontradas" }, { status: 404 })

  const pending = invoices.filter((inv) => !inv.toconline_fc_id)
  const alreadyDone = invoices.length - pending.length

  if (!pending.length)
    return NextResponse.json({ queued: 0, skipped: alreadyDone })

  const cronSecret = process.env.CRON_SECRET ?? ""
  const errors: string[] = []

  // Um request por fatura em paralelo — awaited para garantir que chegam ao n8n
  await Promise.all(
    pending.map(async (inv) => {
      try {
        const res = await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: session.tenant.id,
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
