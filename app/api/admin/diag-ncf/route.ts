import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/api/admin-auth"
import { getValidToken } from "@/lib/toconline/token"

// ROTA DIAGNOSTICA TEMPORARIA - remover apos confirmar o shape das NCF/NC.
// Objetivo: inspecionar contra o TOConline real (Revive Home, modo direto):
//   - que document_type real tem uma nota de credito de compra (NCF) e de venda (NC)
//   - o shape cru do payload e que campo referencia o documento original (FC)
// So super-admin. Nao escreve nada.

export const dynamic = "force-dynamic"

type Json = Record<string, unknown>

async function rawGet(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    /* devolve texto cru abaixo */
  }
  return {
    httpStatus: res.status,
    ok: res.ok,
    json,
    textPreview: json === null ? text.slice(0, 3000) : undefined,
  }
}

// A resposta pode vir como array, {data:[...]}, ou {data:"<json string>"}.
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

// Se for JSON:API ({id,type,attributes:{...}}), sobe os attributes para o topo.
function flatten(el: Json): Json {
  const attrs = el.attributes
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
    return { id: el.id, type: el.type, ...(attrs as Json) }
  }
  return el
}

function countByType(arr: Json[]): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, d) => {
    const t = String(d.document_type ?? "?")
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})
}

const CREDIT_TYPES = new Set(["NCF", "NDF", "NLCF", "NLDF", "NCA", "NC", "NLC", "NLD"])

export async function GET(req: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const tenantId = sp.get("tenant_id")
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id em falta" }, { status: 400 })
  }

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

  // ---- Modo 1: documento unico completo por id (ver o payload cru inteiro) ----
  const docId = sp.get("doc_id")
  if (docId) {
    const kind = sp.get("kind") === "sales" ? "sales" : "purchases"
    const seg =
      kind === "sales" ? "commercial_sales_documents" : "commercial_purchases_documents"
    const single = await rawGet(`${apiBase}/api/v1/${seg}/${docId}`, accessToken)
    return NextResponse.json({ mode: "single", kind, docId, appBase, apiBase, single })
  }

  // ---- Modo 2: NCF via list_for_invoices filtrado (surgir NCF de forma fiavel) --
  if (sp.get("mode") === "ncf-list") {
    const filter = `"document_type in ('NCF','NDF','NLCF','NLDF','NCA')"`
    const url = `${appBase}/api/commercial_purchases_documents_list_for_invoices?filter=${encodeURIComponent(filter)}`
    const raw = await rawGet(url, accessToken)
    const arr = extractArray(raw.json).map(flatten)
    return NextResponse.json({
      mode: "ncf-list",
      appBase,
      apiBase,
      httpStatus: raw.httpStatus,
      count: arr.length,
      countByType: countByType(arr),
      samples: arr.slice(0, 5),
      textPreview: raw.textPreview,
    })
  }

  // ---- Modo 3 (default): listar compras + vendas num intervalo --------------
  const from = sp.get("from") ?? "2024-01-01"
  const to = sp.get("to") ?? new Date().toISOString().slice(0, 10)

  const purchasesRaw = await rawGet(
    `${apiBase}/api/v1/commercial_purchases_documents?date_from=${from}&date_to=${to}`,
    accessToken,
  )
  const salesRaw = await rawGet(
    `${apiBase}/api/v1/commercial_sales_documents?date_from=${from}&date_to=${to}`,
    accessToken,
  )

  const purchases = extractArray(purchasesRaw.json).map(flatten)
  const sales = extractArray(salesRaw.json).map(flatten)

  return NextResponse.json({
    mode: "list",
    appBase,
    apiBase,
    range: { from, to },
    purchases: {
      httpStatus: purchasesRaw.httpStatus,
      count: purchases.length,
      countByType: countByType(purchases),
      firstRaw: purchases.slice(0, 2),
      creditNoteSamples: purchases
        .filter((d) => CREDIT_TYPES.has(String(d.document_type)))
        .slice(0, 3),
      textPreview: purchasesRaw.textPreview,
    },
    sales: {
      httpStatus: salesRaw.httpStatus,
      count: sales.length,
      countByType: countByType(sales),
      firstRaw: sales.slice(0, 2),
      creditNoteSamples: sales
        .filter((d) => CREDIT_TYPES.has(String(d.document_type)))
        .slice(0, 3),
      textPreview: salesRaw.textPreview,
    },
  })
}
