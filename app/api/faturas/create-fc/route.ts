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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://isoflow-seven.vercel.app"
  const cronSecret = process.env.CRON_SECRET ?? ""

  // Fire and forget — n8n chama /api/faturas/{id}/update-fc quando terminar
  fetch(n8nUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: session.tenant.id,
      callback_url: `${appUrl}/api/faturas`,
      callback_secret: cronSecret,
      invoices: pending.map((inv) => ({
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
      })),
    }),
  }).catch(() => null)

  return NextResponse.json({ queued: pending.length, skipped: alreadyDone })
}
