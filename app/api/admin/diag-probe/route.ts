import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/api/admin-auth"
import { getValidToken } from "@/lib/toconline/token"

// ROTA DIAGNOSTICA TEMPORARIA - descobrir como puxar TODOS os documentos de compra.
// Testa varias estrategias contra o TOConline real e reporta contagens/amostras,
// para decidir o leitor definitivo. So super-admin. Nao escreve nada.

export const dynamic = "force-dynamic"

type Json = Record<string, unknown>

async function get(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  return { httpStatus: res.status, ok: res.ok, json, text }
}

function arr(json: unknown): Json[] {
  if (Array.isArray(json)) return json as Json[]
  const o = (json ?? {}) as Json
  if (Array.isArray(o.data)) return o.data as Json[]
  if (typeof o.data === "string") {
    try {
      const p = JSON.parse(o.data) as unknown
      if (Array.isArray(p)) return p as Json[]
      const pp = (p ?? {}) as Json
      return Array.isArray(pp.data) ? (pp.data as Json[]) : []
    } catch {
      return []
    }
  }
  return []
}

function flat(el: Json): Json {
  const a = el.attributes
  return a && typeof a === "object" && !Array.isArray(a) ? { id: el.id, ...(a as Json) } : el
}

function sample(rows: Json[]) {
  return {
    count: rows.length,
    hasNetTotal: rows.length > 0 ? rows[0].net_total !== undefined : null,
    ids: rows.slice(0, 60).map((r) => Number(r.document_id ?? r.id ?? 0)),
    firstFew: rows.slice(0, 4).map((r) => ({
      id: r.document_id ?? r.id,
      type: r.document_type,
      date: r.date,
      net_total: r.net_total,
      gross_total: r.gross_total,
    })),
  }
}

export async function GET(req: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const tenantId = req.nextUrl.searchParams.get("tenant_id")
  if (!tenantId) return NextResponse.json({ error: "tenant_id em falta" }, { status: 400 })

  let token: Awaited<ReturnType<typeof getValidToken>>
  try {
    token = await getValidToken(tenantId)
  } catch (e) {
    return NextResponse.json({ error: "token", detail: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
  const { accessToken, appBase, apiBase } = token
  const seg = "commercial_purchases_documents"
  const out: Json = { appBase, apiBase }

  // 1. v1 sem params (baseline)
  {
    const r = await get(`${apiBase}/api/v1/${seg}`, accessToken)
    out.v1_no_params = { httpStatus: r.httpStatus, ...sample(arr(r.json).map(flat)) }
  }
  // 2. v1 com page[size]=200
  {
    const r = await get(`${apiBase}/api/v1/${seg}?page%5Bsize%5D=200`, accessToken)
    out.v1_pagesize200 = { httpStatus: r.httpStatus, ...sample(arr(r.json).map(flat)) }
  }
  // 3. v1 page[number]=2 (para ver se ha 2a pagina com ids diferentes)
  {
    const r = await get(`${apiBase}/api/v1/${seg}?page%5Bnumber%5D=2&page%5Bsize%5D=100`, accessToken)
    out.v1_page2 = { httpStatus: r.httpStatus, ...sample(arr(r.json).map(flat)) }
  }
  // 4. v1 com per_page=200 (esquema alternativo)
  {
    const r = await get(`${apiBase}/api/v1/${seg}?per_page=200`, accessToken)
    out.v1_perpage200 = { httpStatus: r.httpStatus, ...sample(arr(r.json).map(flat)) }
  }
  // 5. list_for_invoices SEM filtro (ver quantos e que ids)
  {
    const r = await get(`${appBase}/api/${seg}_list_for_invoices`, accessToken)
    out.list_no_filter = { httpStatus: r.httpStatus, ...sample(arr(r.json).map(flat)) }
  }
  // 6. list_for_invoices filtrado a MAIO (testar se o date BETWEEN e' respeitado)
  {
    const f = encodeURIComponent(`"date BETWEEN '2025-05-01' AND '2025-05-31'"`)
    const r = await get(`${appBase}/api/${seg}_list_for_invoices?filter=${f}`, accessToken)
    out.list_may_only = { httpStatus: r.httpStatus, ...sample(arr(r.json).map(flat)) }
  }
  // 7. list_for_invoices filtrado por tipo NCF (baseline conhecido: 9 docs varios meses)
  {
    const f = encodeURIComponent(`"document_type in ('NCF')"`)
    const r = await get(`${appBase}/api/${seg}_list_for_invoices?filter=${f}`, accessToken)
    out.list_ncf_only = { httpStatus: r.httpStatus, ...sample(arr(r.json).map(flat)) }
  }

  return NextResponse.json(out)
}
