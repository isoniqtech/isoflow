/**
 * Webhook: catalogo de categorias de gasto do TOConline, enviado pelo n8n.
 *
 * Mesmo padrao dos outros webhooks (gastos/receita/efatura):
 *   POST https://flow.isoniqtech.com/api/webhooks/categorias
 *   Header: X-ISOFlow-Secret: <CRON_SECRET>
 *   Body:   { "tenant_id": "<uuid>", "categories": [ ... ] }
 *
 * O array aceita o formato cru do TOConline
 * ({attributes:{accounting_number,name,tax_code}}) ou o simples
 * ({code,name,tax_code}). Tambem se aceita "data" em vez de "categories".
 *
 * As categorias sao actualizadas por upsert (tenant_id + code): enviar de novo
 * apenas actualiza, nunca duplica.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { storeCategories, extrairLista } from "@/lib/toconline/expense-categories"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  const secret = req.headers.get("x-isoflow-secret")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const o = (body ?? {}) as Record<string, unknown>
  const tenantId = typeof o.tenant_id === "string" ? o.tenant_id : null
  if (!tenantId) {
    return Response.json({ error: "tenant_id em falta" }, { status: 400 })
  }

  const items = extrairLista(o)
  if (items.length === 0) {
    return Response.json({ error: "sem categorias no payload" }, { status: 400 })
  }

  try {
    // Cast: a tabela e' da migration 040, ainda nao esta' em types/supabase.ts
    const admin = createAdminClient() as unknown as SupabaseClient
    const guardadas = await storeCategories(tenantId, items, admin)
    return Response.json({ ok: true, guardadas })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
