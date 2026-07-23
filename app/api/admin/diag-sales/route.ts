import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/api/admin-auth"
import { getValidToken } from "@/lib/toconline/token"

// ROTA DIAGNOSTICA TEMPORARIA - remover apos confirmar os document_type de venda.
// Objetivo: confirmar contra o TOConline real (Revive Home, modo direto) que
// document_type tem uma fatura de venda (FR/FT/FS?) e uma nota de credito de
// venda (NC), e o sinal do net_total. Os codigos SAF-T PT sao padrao entre
// empresas, por isso servem tambem para o n8n da FINMED.
// So super-admin. Nao escreve nada. Tenta varias estrategias de listagem.

export const dynamic = "force-dynamic"

type Json = Record<string, unknown>

async function probe(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    /* fica em textPreview */
  }
  return { url, httpStatus: res.status, ok: res.ok, json, text }
}

function extractArray(json: unknown): Json[] {
  if (Array.isArray(json)) return json as Json[]
  const obj = (json ?? {}) as Json
  if (Array.isArray(obj.data)) return obj.data as Json[]
  if (typeof obj.data === "string") {
    try {
      const parsed = JSON.parse(obj.data) as unknown
      if (Array.isArray(parsed)) return parsed as Json[]
      const p = (parsed ?? {}) as Json
      return Array.isArray(p.data) ? (p.data as Json[]) : []
    } catch {
      return []
    }
  }
  if (Array.isArray(obj.documents)) return obj.documents as Json[]
  return []
}

function flatten(el: Json): Json {
  const attrs = el.attributes
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
    return { id: el.id, type: el.type, ...(attrs as Json) }
  }
  return el
}

function summarize(json: unknown) {
  const arr = extractArray(json).map(flatten)
  const countByType = arr.reduce<Record<string, number>>((acc, d) => {
    const t = String(d.document_type ?? "?")
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})
  // um exemplo (campos-chave) por cada document_type distinto
  const seen = new Set<string>()
  const samplePerType: Json[] = []
  for (const d of arr) {
    const t = String(d.document_type ?? "?")
    if (seen.has(t)) continue
    seen.add(t)
    samplePerType.push({
      document_type: d.document_type,
      document_no: d.document_no ?? d.document_number,
      status: d.status,
      date: d.date,
      net_total: d.net_total,
      gross_total: d.gross_total,
      external_reference: d.external_reference,
      client_business_name: d.client_business_name,
    })
  }
  return { count: arr.length, countByType, samplePerType }
}

export async function GET(req: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const tenantId = sp.get("tenant_id")
  if (!tenantId) return NextResponse.json({ error: "tenant_id em falta" }, { status: 400 })

  let token: Awaited<ReturnType<typeof getValidToken>>
  try {
    token = await getValidToken(tenantId)
  } catch (e) {
    return NextResponse.json(
      { error: "token", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
  const { accessToken, apiBase, appBase } = token

  const from = sp.get("from") ?? "2025-01-01"
  const to = sp.get("to") ?? "2025-12-31"
  const dateFilter = encodeURIComponent(`"date BETWEEN '${from}' AND '${to}'"`)

  const strategies: Array<{ name: string; url: string }> = [
    {
      name: "v1_filter",
      url: `${apiBase}/api/v1/commercial_sales_documents?filter=${dateFilter}`,
    },
    {
      name: "v1_date_params",
      url: `${apiBase}/api/v1/commercial_sales_documents?date_from=${from}&date_to=${to}`,
    },
    {
      name: "app_list_for_invoices",
      url: `${appBase}/api/commercial_sales_documents_list_for_invoices?filter=${dateFilter}`,
    },
    {
      name: "v1_no_params",
      url: `${apiBase}/api/v1/commercial_sales_documents`,
    },
  ]

  const results: Json[] = []
  for (const s of strategies) {
    const r = await probe(s.url, accessToken)
    const worked = r.ok && extractArray(r.json).length > 0
    results.push({
      strategy: s.name,
      url: s.url,
      httpStatus: r.httpStatus,
      ok: r.ok,
      ...(worked ? summarize(r.json) : { errorBody: r.text.slice(0, 1500) }),
    })
  }

  return NextResponse.json({ tenantId, appBase, apiBase, range: { from, to }, results })
}
