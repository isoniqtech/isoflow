/**
 * ROTA TEMPORÁRIA DE DIAGNÓSTICO - remover após diagnosticar a e-Fatura direta.
 * Só super-admin. Mostra a resposta CRUA do TOConline document_associations
 * para a Revive Home, em vários meses, para percebermos se há dados ou não.
 */
import { getApiContext, jsonError } from "@/lib/api/auth"
import { getValidToken } from "@/lib/toconline/token"
import { fetchDocumentAssociations } from "@/lib/integrations/toconline"

export const runtime = "nodejs"
export const maxDuration = 60

const REVIVE_TENANT_ID = "475826a5-d08c-4e99-8b95-39b48a245949"

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (process.env.SUPER_ADMIN_USER_ID !== ctx.userId) return jsonError("Forbidden", 403)

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get("tenant") || REVIVE_TENANT_ID
  const monthsBack = Number(searchParams.get("months") ?? 4)

  let tokenInfo: { appBase: string } | null = null
  try {
    const t = await getValidToken(tenantId)
    tokenInfo = { appBase: t.appBase }

    // Datas de referência sem depender de Date.now no cliente: usamos o servidor.
    const now = new Date()
    const ranges: Array<{ from: string; to: string }> = []
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const lastStr = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
      ranges.push({ from: first, to: lastStr })
    }

    const results = []
    for (const range of ranges) {
      const url = new URL(`${t.appBase.replace(/\/$/, "")}/api/document_associations`)
      url.searchParams.set("filter", `"date BETWEEN '${range.from}' AND '${range.to}'"`)

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${t.accessToken}`, Accept: "application/json" },
      })
      const rawText = await res.text()

      // Também correr o parser da app para comparar contagem
      let parsedCount = -1
      let parsedSample: unknown = null
      try {
        const docs = await fetchDocumentAssociations(t.accessToken, t.appBase, range.from, range.to)
        parsedCount = docs.length
        parsedSample = docs.slice(0, 3)
      } catch (e) {
        parsedSample = { parseError: e instanceof Error ? e.message : String(e) }
      }

      results.push({
        range,
        url: url.toString(),
        http_status: res.status,
        raw_length: rawText.length,
        raw_preview: rawText.slice(0, 1500),
        parsed_count: parsedCount,
        parsed_sample: parsedSample,
      })
    }

    return Response.json({ tenantId, appBase: tokenInfo.appBase, results })
  } catch (e) {
    return Response.json({
      tenantId,
      appBase: tokenInfo?.appBase ?? null,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
