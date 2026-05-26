import { timingSafeEqual } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { decryptOptional } from "@/lib/utils/encryption"
import { fetchSalesDocuments } from "@/lib/integrations/toconline"

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
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`
  const dateTo = now.toISOString().slice(0, 10)

  const { data: integrations, error } = await supabase
    .from("tenant_integrations")
    .select("tenant_id, api_key_encrypted, config")
    .eq("type", "erp")
    .eq("provider", "toconline")
    .eq("is_active", true)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{ tenant_id: string; total: number; error?: string }> = []

  for (const integration of integrations ?? []) {
    try {
      const accessToken = decryptOptional(integration.api_key_encrypted)
      if (!accessToken) {
        results.push({ tenant_id: integration.tenant_id, total: 0, error: "Missing token" })
        continue
      }

      const config = (integration.config ?? {}) as Record<string, string>
      const baseUrl = config.base_url ?? "https://app.toconline.pt"

      const docs = await fetchSalesDocuments(accessToken, baseUrl, { dateFrom, dateTo })
      const total = docs.reduce((sum, doc) => sum + Number(doc.total ?? 0), 0)
      const rounded = Math.round(total * 100) / 100

      await supabase
        .from("tenants")
        .update({
          toconline_revenue_total: rounded,
          toconline_revenue_month: month,
          toconline_revenue_year: year,
          toconline_revenue_cached_at: now.toISOString(),
        })
        .eq("id", integration.tenant_id)

      results.push({ tenant_id: integration.tenant_id, total: rounded })
    } catch (e) {
      results.push({
        tenant_id: integration.tenant_id,
        total: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return Response.json({ month, year, results })
}
