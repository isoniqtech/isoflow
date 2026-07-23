/**
 * Leitura de documentos (vendas/compras) por intervalo de datas no TOConline
 * modo direto, com net_total fiavel.
 *
 * Como: o endpoint v1 `/api/v1/commercial_{sales,purchases}_documents` devolve
 * TODOS os documentos com net_total + date + document_type, e PAGINA com
 * page[number]/page[size] (confirmado contra dados reais - Revive, 292 compras).
 * Rejeita date_from/date_to e filter (400), por isso o filtro por data e' feito
 * do lado do cliente. (A vista `_list_for_invoices` aceita datas mas nao tem
 * net_total e ignora o filtro de data nas compras - nao serve.)
 */

export type Segment = "commercial_sales_documents" | "commercial_purchases_documents"

export interface DocNet {
  id: number
  document_type: string
  date: string | null
  net_total: number
  gross_total: number
}

const PAGE_SIZE = 200
const MAX_PAGES = 500 // salvaguarda (200 * 500 = 100k docs)

function toArray(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>
  const obj = (body ?? {}) as Record<string, unknown>
  if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>
  if (typeof obj.data === "string") {
    try {
      const parsed = JSON.parse(obj.data) as unknown
      if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>
      const p = (parsed ?? {}) as Record<string, unknown>
      return Array.isArray(p.data) ? (p.data as Array<Record<string, unknown>>) : []
    } catch {
      return []
    }
  }
  return []
}

function flat(el: Record<string, unknown>): Record<string, unknown> {
  const a = el.attributes
  return a && typeof a === "object" && !Array.isArray(a)
    ? { id: el.id, ...(a as Record<string, unknown>) }
    : el
}

/**
 * Todos os documentos de um segmento (paginacao v1 ate esgotar).
 */
export async function fetchAllV1Docs(
  accessToken: string,
  apiBase: string,
  segment: Segment,
): Promise<DocNet[]> {
  const out: DocNet[] = []
  const seen = new Set<number>()

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${apiBase.replace(/\/$/, "")}/api/v1/${segment}?page%5Bnumber%5D=${page}&page%5Bsize%5D=${PAGE_SIZE}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    })
    if (!res.ok) {
      if (page === 1) {
        throw new Error(`TOConline v1 ${segment} ${res.status}: ${(await res.text()).slice(0, 200)}`)
      }
      break
    }
    const rows = toArray(await res.json()).map(flat)
    if (rows.length === 0) break

    let added = 0
    for (const r of rows) {
      const id = Number(r.id ?? r.document_id ?? 0)
      if (id > 0 && !seen.has(id)) {
        seen.add(id)
        out.push({
          id,
          document_type: String(r.document_type ?? ""),
          date: (r.date as string | null) ?? null,
          net_total: Number(r.net_total ?? r.subtotal ?? 0),
          gross_total: Number(r.gross_total ?? r.total ?? 0),
        })
        added++
      }
    }
    // Fim: pagina incompleta, ou pagina repetida (servidor ignora page[number]).
    if (rows.length < PAGE_SIZE || added === 0) break
  }

  return out
}

/**
 * Documentos de um segmento num intervalo de datas (filtro por data e, opcional,
 * por tipo, do lado do cliente). net_total fiavel do v1.
 */
export async function fetchDocsNetByDate(
  accessToken: string,
  apiBase: string,
  segment: Segment,
  from: string,
  to: string,
  onlyTypes?: Set<string>,
): Promise<DocNet[]> {
  const all = await fetchAllV1Docs(accessToken, apiBase, segment)
  return all.filter((d) => {
    if (!d.date || d.date < from || d.date > to) return false
    if (onlyTypes && !onlyTypes.has(d.document_type.toUpperCase())) return false
    return true
  })
}
