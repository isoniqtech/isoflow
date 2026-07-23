/**
 * Leitura FIAVEL de documentos (vendas/compras) por intervalo de datas no
 * TOConline modo direto.
 *
 * Porque: o endpoint v1 `/api/v1/commercial_{sales,purchases}_documents` REJEITA
 * date_from/date_to (400 JA010) e filter (400 JA000). A vista custom
 * `.../{segment}_list_for_invoices?filter="date BETWEEN..."` aceita datas mas so
 * traz gross_total (sem net_total). Como a receita/gastos sao em LIQUIDO,
 * listamos por data na vista custom e vamos buscar o net_total de cada documento
 * ao v1 por id.
 *
 * Confirmado contra dados reais (Revive Home, app13/api13, 2026-07-23):
 *  - list_for_invoices devolve document_id, document_type, date, gross_total
 *  - v1/{segment}/{id} devolve net_total
 */

export type Segment = "commercial_sales_documents" | "commercial_purchases_documents"

export interface DocByDate {
  id: number
  document_type: string
  date: string | null
}

export interface DocNet extends DocByDate {
  net_total: number
  gross_total: number
}

function toArray(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>
  const obj = (body ?? {}) as Record<string, unknown>
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
  if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>
  return []
}

function flat(el: Record<string, unknown>): Record<string, unknown> {
  const attrs = el.attributes
  return attrs && typeof attrs === "object" && !Array.isArray(attrs)
    ? { ...(attrs as Record<string, unknown>), id: el.id }
    : el
}

/**
 * Lista os documentos de um segmento num intervalo de datas (via list_for_invoices).
 * Devolve id + document_type + date (o gross_total nao e' fiavel em liquido).
 */
export async function listDocsByDate(
  accessToken: string,
  appBase: string,
  segment: Segment,
  from: string,
  to: string,
): Promise<DocByDate[]> {
  const filter = encodeURIComponent(`"date BETWEEN '${from}' AND '${to}'"`)
  const base = `${appBase.replace(/\/$/, "")}/api/${segment}_list_for_invoices?filter=${filter}`

  // O endpoint pagina/limita (~10 por pagina). Percorrer as paginas com dedup por
  // id: paramos quando uma pagina nao traz nenhum id novo (robusto tanto se o
  // servidor respeitar page[number] como se o ignorar).
  const seen = new Set<number>()
  const out: DocByDate[] = []
  const MAX_PAGES = 200

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}&page%5Bnumber%5D=${page}&page%5Bsize%5D=200`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    })
    if (!res.ok) {
      if (page === 1) {
        throw new Error(
          `TOConline ${segment}_list_for_invoices ${res.status}: ${(await res.text()).slice(0, 200)}`,
        )
      }
      break // paginas seguintes: parar no primeiro erro
    }
    const rows = toArray(await res.json()).map(flat)
    if (rows.length === 0) break

    let added = 0
    for (const r of rows) {
      const id = Number(r.document_id ?? r.id ?? 0)
      if (id > 0 && !seen.has(id)) {
        seen.add(id)
        out.push({
          id,
          document_type: String(r.document_type ?? ""),
          date: (r.date as string | null) ?? null,
        })
        added++
      }
    }
    if (added === 0) break // sem ids novos -> fim (ou servidor ignora paginacao)
  }

  return out
}

/** Vai buscar o net_total (e gross_total) de um documento ao v1 por id. */
async function fetchDocNet(
  accessToken: string,
  apiBase: string,
  segment: Segment,
  doc: DocByDate,
): Promise<DocNet | null> {
  const url = `${apiBase.replace(/\/$/, "")}/api/v1/${segment}/${doc.id}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  })
  if (!res.ok) return null
  const body = (await res.json()) as Record<string, unknown>
  const d = (body.data ?? body) as Record<string, unknown>
  const attrs = (d.attributes ?? d) as Record<string, unknown>
  const net = Number(attrs.net_total ?? attrs.subtotal ?? 0)
  const gross = Number(attrs.gross_total ?? attrs.total ?? 0)
  return { ...doc, net_total: net, gross_total: gross }
}

async function inBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    out.push(...(await Promise.all(batch.map(fn))))
  }
  return out
}

/**
 * Documentos de um segmento num intervalo de datas, com net_total fiavel.
 * Opcionalmente filtra por tipos de documento (para reduzir chamadas ao v1).
 */
export async function fetchDocsNetByDate(
  accessToken: string,
  appBase: string,
  apiBase: string,
  segment: Segment,
  from: string,
  to: string,
  onlyTypes?: Set<string>,
): Promise<DocNet[]> {
  const listed = await listDocsByDate(accessToken, appBase, segment, from, to)
  const relevant = onlyTypes
    ? listed.filter((d) => onlyTypes.has(d.document_type.toUpperCase()))
    : listed
  const fetched = await inBatches(relevant, 5, (d) =>
    fetchDocNet(accessToken, apiBase, segment, d),
  )
  return fetched.filter((d): d is DocNet => d !== null)
}
