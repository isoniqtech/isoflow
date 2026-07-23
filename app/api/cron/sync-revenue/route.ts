import { timingSafeEqual } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { decryptOptional } from "@/lib/utils/encryption"
import { fetchSalesDocuments, sumSalesRevenue } from "@/lib/integrations/toconline"
import { getValidToken } from "@/lib/toconline/token"

function verifySecret(header: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !header) return false
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header
  try {
    return timingSafeEqual(Buffer.from(secret), Buffer.from(provided))
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  if (!verifySecret(req.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const isFirstOfMonth = now.getDate() === 1

  // Mês anterior (para snapshot definitivo no dia 1)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
  const prevDateFrom = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`
  const prevDateTo = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`

  // Mês corrente
  const currentDateFrom = `${year}-${String(month).padStart(2, "0")}-01`
  const currentDateTo = now.toISOString().slice(0, 10)

  const { data: integrations, error } = await supabase
    .from("tenant_integrations")
    .select("tenant_id, api_key_encrypted, config")
    .eq("type", "erp")
    .eq("provider", "toconline")
    .eq("is_active", true)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Obter integration_mode de cada tenant
  const tenantIds = (integrations ?? []).map((i) => i.tenant_id)
  const { data: tenantsData } = tenantIds.length
    ? await supabase.from("tenants").select("id, integration_mode").in("id", tenantIds)
    : { data: [] as Array<{ id: string; integration_mode: string | null }> }

  const tenantModeMap = new Map(
    (tenantsData ?? []).map((t) => [t.id, t.integration_mode ?? "n8n"]),
  )

  const results: Array<{
    tenant_id: string
    current_total: number
    prev_total?: number
    error?: string
  }> = []

  for (const integration of integrations ?? []) {
    try {
      const mode = tenantModeMap.get(integration.tenant_id) ?? "n8n"
      const config = (integration.config ?? {}) as Record<string, string>

      let accessToken: string
      let baseUrl: string

      if (mode === "toconline_direct") {
        // Modo direto: refresh OAuth automático
        const tokenConfig = await getValidToken(integration.tenant_id)
        accessToken = tokenConfig.accessToken
        baseUrl = tokenConfig.apiBase
      } else {
        // Modo n8n: usa token armazenado diretamente
        const stored = decryptOptional(integration.api_key_encrypted)
        if (!stored) {
          results.push({ tenant_id: integration.tenant_id, current_total: 0, error: "Missing token" })
          continue
        }
        accessToken = stored
        baseUrl = config.base_url ?? "https://app.toconline.pt"
      }

      // Mês corrente
      const currentDocs = await fetchSalesDocuments(accessToken, baseUrl, {
        dateFrom: currentDateFrom,
        dateTo: currentDateTo,
      })
      // receita = soma(FR+FT+FS) - soma(NC); NLD/NLC/SHI ignorados.
      const currentTotal = Math.round(sumSalesRevenue(currentDocs) * 100) / 100

      await Promise.all([
        supabase
          .from("tenants")
          .update({
            toconline_revenue_total: currentTotal,
            toconline_revenue_month: month,
            toconline_revenue_year: year,
            toconline_revenue_cached_at: now.toISOString(),
          })
          .eq("id", integration.tenant_id)
          .then(() => void 0),
        supabase
          .from("monthly_snapshots")
          .upsert(
            { tenant_id: integration.tenant_id, month, year, revenue: currentTotal, saved_at: now.toISOString() },
            { onConflict: "tenant_id,month,year" },
          )
          .then(() => void 0),
      ])

      let prevTotal: number | undefined

      if (isFirstOfMonth) {
        // Dia 1: buscar mês anterior completo para snapshot definitivo
        const prevDocs = await fetchSalesDocuments(accessToken, baseUrl, {
          dateFrom: prevDateFrom,
          dateTo: prevDateTo,
        })
        prevTotal = Math.round(sumSalesRevenue(prevDocs) * 100) / 100

        await supabase
          .from("monthly_snapshots")
          .upsert(
            {
              tenant_id: integration.tenant_id,
              month: prevMonth,
              year: prevYear,
              revenue: prevTotal,
              saved_at: now.toISOString(),
            },
            { onConflict: "tenant_id,month,year" },
          )
      }
      results.push({ tenant_id: integration.tenant_id, current_total: currentTotal, prev_total: prevTotal })
    } catch (e) {
      results.push({
        tenant_id: integration.tenant_id,
        current_total: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return Response.json({ month, year, is_first_of_month: isFirstOfMonth, results })
}
