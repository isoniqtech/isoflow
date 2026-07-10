import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { getValidToken } from "@/lib/toconline/token"
import { fetchSalesDocuments, fetchPurchaseDocuments } from "@/lib/integrations/toconline"

export const maxDuration = 120

export async function POST() {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(session.role, "configuracoes", "view_all"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = createClient()
  const svc = createServiceClient()
  const tenantId = session.tenant.id

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("integration_mode")
    .eq("id", tenantId)
    .maybeSingle()

  if ((tenantRow as { integration_mode?: string } | null)?.integration_mode !== "toconline_direct") {
    return NextResponse.json({ error: "Apenas disponivel em modo TOConline Direct" }, { status: 400 })
  }

  let tokenConfig: Awaited<ReturnType<typeof getValidToken>>
  try {
    tokenConfig = await getValidToken(tenantId)
  } catch (e) {
    return NextResponse.json(
      { error: `TOConline nao disponivel: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 },
    )
  }

  const { accessToken, apiBase } = tokenConfig
  const now = new Date()

  // Buscar todos os documentos de uma vez (sem filtro de data - API nao suporta date_from/date_to)
  // apiBase = https://api13.toconline.pt (confirmar com workflow n8n)
  let allSales: Awaited<ReturnType<typeof fetchSalesDocuments>> = []
  let allPurchases: Awaited<ReturnType<typeof fetchPurchaseDocuments>> = []

  try {
    ;[allSales, allPurchases] = await Promise.all([
      fetchSalesDocuments(accessToken, apiBase),
      fetchPurchaseDocuments(accessToken, apiBase),
    ])
  } catch (e) {
    return NextResponse.json(
      { error: `Erro ao buscar documentos TOConline: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    )
  }

  // Agrupar por ano-mes
  type MonthKey = string // "YYYY-MM"
  const salesByMonth = new Map<MonthKey, number>()
  const purchasesByMonth = new Map<MonthKey, number>()

  for (const doc of allSales) {
    const key = doc.date?.slice(0, 7) // "YYYY-MM"
    if (!key || key.length !== 7) continue
    salesByMonth.set(key, (salesByMonth.get(key) ?? 0) + Number(doc.net_total ?? doc.subtotal ?? 0))
  }
  for (const doc of allPurchases) {
    const key = doc.date?.slice(0, 7)
    if (!key || key.length !== 7) continue
    purchasesByMonth.set(key, (purchasesByMonth.get(key) ?? 0) + Number(doc.net_total ?? doc.subtotal ?? 0))
  }

  // Todos os meses desde Jan/2025 ate ao mes atual
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const months: Array<{ month: number; year: number }> = []
  for (let y = 2025; y <= currentYear; y++) {
    const endMonth = y === currentYear ? currentMonth : 12
    for (let m = 1; m <= endMonth; m++) {
      months.push({ month: m, year: y })
    }
  }

  let processed = 0
  const errors: string[] = []
  const savedAt = now.toISOString()

  for (const { month, year } of months) {
    const key = `${year}-${String(month).padStart(2, "0")}`
    const revenue = Math.round((salesByMonth.get(key) ?? 0) * 100) / 100
    const expenses = Math.round((purchasesByMonth.get(key) ?? 0) * 100) / 100

    try {
      const { data: existing } = await svc
        .from("monthly_snapshots")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle()

      if (existing) {
        await svc
          .from("monthly_snapshots")
          .update({ revenue, expenses, saved_at: savedAt })
          .eq("tenant_id", tenantId)
          .eq("month", month)
          .eq("year", year)
      } else {
        await svc
          .from("monthly_snapshots")
          .insert({ tenant_id: tenantId, month, year, revenue, expenses, saved_at: savedAt })
      }

      processed++
    } catch (e) {
      const label = `${String(month).padStart(2, "0")}/${year}`
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[import-historico] ${label}:`, msg)
      errors.push(`${label}: ${msg}`)
    }
  }

  // Registar data de importacao na config da integracao
  const importedAt = now.toISOString()
  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("id, config")
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()

  if (integration) {
    const currentConfig = (integration.config as Record<string, unknown>) ?? {}
    await svc
      .from("tenant_integrations")
      .update({ config: { ...currentConfig, historico_importado_at: importedAt } })
      .eq("id", integration.id)
  }

  return NextResponse.json({ ok: true, months_processed: processed, errors, imported_at: importedAt })
}
