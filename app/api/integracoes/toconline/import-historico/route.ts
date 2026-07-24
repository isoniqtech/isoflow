import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createServiceClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { runSnapshotSync } from "@/lib/snapshots/sync"

export const maxDuration = 120

/**
 * Backfill de snapshots (receita + gastos) de jan/2025 ate hoje, num clique.
 * Serve os DOIS modos: direto (OAuth proprio) e n8n (via proxy) - o transporte
 * e' resolvido pelo tocRequest dentro do runSnapshotSync. Substitui os
 * workflows n8n manuais de receita/gastos.
 */
export async function POST() {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(session.role, "configuracoes", "view_all"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const svc = createServiceClient()
  const tenantId = session.tenant.id
  const now = new Date()

  const rangeFrom = "2025-01-01"
  const rangeTo = now.toISOString().slice(0, 10)

  let result: Awaited<ReturnType<typeof runSnapshotSync>>
  try {
    result = await runSnapshotSync(tenantId, rangeFrom, rangeTo)
  } catch (e) {
    return NextResponse.json(
      { error: `Erro ao importar historico do TOConline: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    )
  }

  // Registar data de importacao na integracao ERP ativa (n8n ou toconline).
  const importedAt = now.toISOString()
  const { data: integration } = await svc
    .from("tenant_integrations")
    .select("id, config")
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("is_active", true)
    .in("provider", ["toconline", "n8n"])
    .maybeSingle()

  if (integration) {
    const currentConfig = (integration.config as Record<string, unknown>) ?? {}
    await svc
      .from("tenant_integrations")
      .update({ config: { ...currentConfig, historico_importado_at: importedAt } })
      .eq("id", integration.id)
  }

  return NextResponse.json({
    ok: true,
    months_processed: result.months_processed,
    errors: result.errors,
    imported_at: importedAt,
  })
}
