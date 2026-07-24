import { timingSafeEqual } from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { runSnapshotSync } from "@/lib/snapshots/sync"

export const runtime = "nodejs"
export const maxDuration = 300

// Manutencao diaria dos snapshots (receita + gastos) para TODOS os tenants com
// ERP TOConline ativo - direto (Revive) e n8n (FINMED, via proxy). Substitui os
// workflows n8n de receita/gastos. Janela: inicio do mes anterior -> hoje, que
// refresca o mes corrente e finaliza o anterior (equivale ao "sweep" do wf).
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
  return run()
}

// Vercel Cron chama GET por defeito.
export async function GET(req: Request) {
  if (!verifySecret(req.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return run()
}

async function run() {
  const svc = createServiceClient()

  const { data: integrations, error } = await svc
    .from("tenant_integrations")
    .select("tenant_id")
    .eq("type", "erp")
    .eq("is_active", true)
    .in("provider", ["toconline", "n8n"])

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const tenantIds = Array.from(new Set((integrations ?? []).map((i) => i.tenant_id)))

  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const from = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`
  const to = now.toISOString().slice(0, 10)

  const results: Array<{ tenant_id: string; result?: unknown; error?: string }> = []
  for (const tenantId of tenantIds) {
    try {
      const result = await runSnapshotSync(tenantId, from, to)
      results.push({ tenant_id: tenantId, result })
    } catch (e) {
      results.push({ tenant_id: tenantId, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({ tenants: tenantIds.length, from, to, results })
}
