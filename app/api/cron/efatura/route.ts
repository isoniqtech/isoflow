import { timingSafeEqual } from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { runEfaturaSync } from "@/lib/efatura/sync"

export const runtime = "nodejs"
export const maxDuration = 300

// Sync mensal de e-Fatura (vercel.json: dia 1 de cada mes). Substitui o Schedule
// que vivia no workflow n8n do FINMED. Serve os DOIS modos: direto (Revive, que
// antes nao tinha automatico) e n8n (FINMED, via proxy). Janela default de 2
// meses = mes atual + anterior; a correr no dia 1, o anterior e' o mes que o
// TOConline acaba de publicar.
const MONTHS = 2

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

// Permitir GET tambem (o Vercel Cron chama GET por defeito).
export async function GET(req: Request) {
  if (!verifySecret(req.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return run()
}

async function run() {
  const supabase = createServiceClient()

  // Tenants com integracao ERP ativa (direto: provider=toconline; n8n: provider=n8n)
  const { data: integrations, error } = await supabase
    .from("tenant_integrations")
    .select("tenant_id, provider")
    .eq("type", "erp")
    .eq("is_active", true)
    .in("provider", ["toconline", "n8n"])

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const tenantIds = Array.from(new Set((integrations ?? []).map((i) => i.tenant_id)))

  const results: Array<{ tenant_id: string; result?: unknown; error?: string }> = []
  for (const tenantId of tenantIds) {
    try {
      const result = await runEfaturaSync(tenantId, MONTHS)
      results.push({ tenant_id: tenantId, result })
    } catch (e) {
      results.push({ tenant_id: tenantId, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({ tenants: tenantIds.length, results })
}
