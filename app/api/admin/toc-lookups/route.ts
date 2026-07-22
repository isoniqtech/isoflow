/**
 * ROTA TEMPORÁRIA DE DIAGNÓSTICO - remover após descobrir os endpoints.
 * Só super-admin. Sonda endpoints candidatos do TOConline (categorias de
 * gasto / itens / impostos) para a Revive, e mostra quais respondem e o que
 * devolvem. Read-only (só GET).
 */
import { getApiContext, jsonError } from "@/lib/api/auth"
import { getValidToken } from "@/lib/toconline/token"

export const runtime = "nodejs"
export const maxDuration = 60

const REVIVE_TENANT_ID = "475826a5-d08c-4e99-8b95-39b48a245949"

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (process.env.SUPER_ADMIN_USER_ID !== ctx.userId) return jsonError("Forbidden", 403)

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get("tenant") || REVIVE_TENANT_ID

  let t: Awaited<ReturnType<typeof getValidToken>>
  try {
    t = await getValidToken(tenantId)
  } catch (e) {
    return Response.json({ error: `token: ${e instanceof Error ? e.message : String(e)}` })
  }

  const { appBase, apiBase, accessToken } = t

  // Endpoints candidatos (categorias de gasto / itens / impostos)
  const candidates = [
    `${appBase}/api/expense_categories`,
    `${appBase}/api/expense_categories_moac`,
    `${apiBase}/api/v1/expense_categories`,
    `${appBase}/api/items`,
    `${apiBase}/api/v1/items`,
    `${appBase}/api/products`,
    `${apiBase}/api/v1/products`,
    `${appBase}/api/chart_of_accounts`,
    `${apiBase}/api/v1/chart_of_accounts`,
    `${appBase}/api/taxes`,
    `${apiBase}/api/v1/taxes`,
    `${appBase}/api/tax_codes`,
  ]
  const extra = searchParams.get("paths")
  if (extra) {
    for (const p of extra.split(",")) {
      const path = p.trim()
      if (path) candidates.push(path.startsWith("http") ? path : `${appBase}${path.startsWith("/") ? "" : "/"}${path}`)
    }
  }

  const results = []
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      })
      const text = await res.text()
      results.push({ url, http_status: res.status, length: text.length, preview: text.slice(0, 600) })
    } catch (e) {
      results.push({ url, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({ tenantId, appBase, apiBase, results })
}
