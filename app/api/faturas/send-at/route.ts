import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { sendDocumentToAT } from "@/lib/integrations/toconline"
import { hasPermission } from "@/lib/utils/permissions"

const bodySchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(100),
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

  const { invoice_ids } = parsed.data
  const supabase = createClient()

  // Fetch Toconline integration for this tenant
  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("config, api_key_encrypted")
    .eq("tenant_id", session.tenant.id)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .eq("is_active", true)
    .single()

  if (!integration) {
    return NextResponse.json(
      { error: "Integração Toconline não configurada" },
      { status: 422 },
    )
  }

  const accessToken = integration.api_key_encrypted as string
  const baseUrl =
    (integration.config as Record<string, string> | null)?.base_url ??
    "https://api13.toconline.pt"

  // Fetch target invoices (must belong to this tenant and have erp_document_id)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, erp_document_id, type, at_communicated")
    .eq("tenant_id", session.tenant.id)
    .in("id", invoice_ids)

  if (!invoices?.length) {
    return NextResponse.json({ error: "Nenhuma fatura encontrada" }, { status: 404 })
  }

  const results = { sent: 0, skipped: 0, errors: [] as string[] }

  for (const inv of invoices) {
    if (inv.at_communicated) {
      results.skipped++
      continue
    }
    if (!inv.erp_document_id) {
      results.errors.push(`Fatura ${inv.id}: sem erp_document_id`)
      continue
    }

    try {
      await sendDocumentToAT(
        accessToken,
        baseUrl,
        inv.erp_document_id,
        inv.type as "incoming" | "outgoing",
      )
      await supabase
        .from("invoices")
        .update({
          at_communicated: true,
          at_communicated_at: new Date().toISOString(),
        })
        .eq("id", inv.id)
        .eq("tenant_id", session.tenant.id)
      results.sent++
    } catch (err) {
      results.errors.push(
        `Fatura ${inv.id}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return NextResponse.json(results)
}
