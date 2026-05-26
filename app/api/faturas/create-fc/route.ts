import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"

const bodySchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(50),
})

type N8NResult = {
  isoflow_id: string | null
  fc_id: string | null
  fc_number: string | null
  success: boolean
}

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(session.role, "faturas", "edit"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const n8nUrl = process.env.N8N_CREATE_FC_WEBHOOK_URL
  if (!n8nUrl)
    return NextResponse.json({ error: "N8N_CREATE_FC_WEBHOOK_URL não configurado" }, { status: 503 })

  const supabase = createClient()

  // Fetch invoice data (only invoices that don't have FC yet)
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      "id, supplier_name, supplier_nif, invoice_number, invoice_date, subtotal, vat_rate, vat_amount, total, description, currency, toconline_fc_id",
    )
    .eq("tenant_id", session.tenant.id)
    .in("id", parsed.data.invoice_ids)

  if (error || !invoices?.length)
    return NextResponse.json({ error: "Faturas não encontradas" }, { status: 404 })

  // Filter out invoices that already have a FC
  const pending = invoices.filter((inv) => !inv.toconline_fc_id)
  const alreadyDone = invoices.length - pending.length

  if (!pending.length)
    return NextResponse.json({
      created: 0,
      skipped: alreadyDone,
      errors: [],
    })

  // Call n8n webhook (synchronous — n8n responds after creating FCs)
  let n8nResponse: { results: N8NResult[] }
  try {
    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: session.tenant.id,
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
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Erro n8n: ${res.status} — ${text.slice(0, 200)}` },
        { status: 502 },
      )
    }

    n8nResponse = await res.json()
  } catch (err) {
    return NextResponse.json(
      { error: `Falha na ligação ao n8n: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    )
  }

  const results = n8nResponse.results ?? []
  const errors: string[] = []
  let created = 0

  for (const result of results) {
    if (!result.success || !result.fc_id || !result.isoflow_id) {
      errors.push(`Fatura ${result.isoflow_id ?? "?"}: FC não criada`)
      continue
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({ toconline_fc_id: result.fc_id })
      .eq("id", result.isoflow_id)
      .eq("tenant_id", session.tenant.id)

    if (updateError) {
      errors.push(`Fatura ${result.isoflow_id}: erro ao guardar FC (${updateError.message})`)
    } else {
      created++
    }
  }

  return NextResponse.json({
    created,
    skipped: alreadyDone,
    errors,
  })
}
