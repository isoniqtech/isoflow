import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getValidToken } from "@/lib/toconline/token"

export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const svc = createServiceClient()

  // Buscar todos os tenants em modo direto com integracao ativa
  const { data: rows, error } = await svc
    .from("tenant_integrations")
    .select("tenant_id")
    .eq("type", "erp")
    .eq("provider", "toconline")
    .eq("is_active", true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filtrar apenas tenants em modo toconline_direct
  const tenantIds = (rows ?? []).map((r) => r.tenant_id as string)
  if (!tenantIds.length) {
    return NextResponse.json({ ok: true, refreshed: 0, skipped: 0, errors: [] })
  }

  const { data: tenantRows } = await svc
    .from("tenants")
    .select("id")
    .in("id", tenantIds)
    .eq("integration_mode" as never, "toconline_direct")

  const directTenants = (tenantRows ?? []).map((t) => t.id as string)

  let refreshed = 0
  let skipped = 0
  const errors: string[] = []

  for (const tenantId of directTenants) {
    try {
      await getValidToken(tenantId)
      refreshed++
    } catch (e) {
      skipped++
      errors.push(`${tenantId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, refreshed, skipped, errors })
}
