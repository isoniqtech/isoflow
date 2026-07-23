import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/api/admin-auth"
import { getValidToken } from "@/lib/toconline/token"
import { fetchDocsNetByDate } from "@/lib/integrations/toconline-daterange"
import {
  salesRevenueSign,
  purchaseExpenseSign,
  REVENUE_DOC_TYPES,
  EXPENSE_DOC_TYPES_ALL,
} from "@/lib/integrations/toconline"

// ROTA DIAGNOSTICA TEMPORARIA - confirmar o leitor por data (list_for_invoices +
// net_total do v1) contra o TOConline real. Usa os MESMOS helpers dos crons.
// Devolve receita (FR+FT+FS - NC) e gastos (FC/DSP - NCF) por intervalo.
// So super-admin. Nao escreve nada.

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const tenantId = sp.get("tenant_id")
  if (!tenantId) return NextResponse.json({ error: "tenant_id em falta" }, { status: 400 })
  const from = sp.get("from") ?? "2025-01-01"
  const to = sp.get("to") ?? "2025-12-31"

  let token: Awaited<ReturnType<typeof getValidToken>>
  try {
    token = await getValidToken(tenantId)
  } catch (e) {
    return NextResponse.json(
      { error: "token", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
  const { accessToken, appBase, apiBase } = token

  try {
    const sales = await fetchDocsNetByDate(
      accessToken,
      appBase,
      apiBase,
      "commercial_sales_documents",
      from,
      to,
      REVENUE_DOC_TYPES,
    )
    const purchases = await fetchDocsNetByDate(
      accessToken,
      appBase,
      apiBase,
      "commercial_purchases_documents",
      from,
      to,
      EXPENSE_DOC_TYPES_ALL,
    )

    const revenue =
      Math.round(sales.reduce((s, d) => s + salesRevenueSign(d.document_type) * d.net_total, 0) * 100) / 100
    const expenses =
      Math.round(purchases.reduce((s, d) => s + purchaseExpenseSign(d.document_type) * d.net_total, 0) * 100) / 100

    return NextResponse.json({
      range: { from, to },
      appBase,
      apiBase,
      revenue: {
        total_net: revenue,
        doc_count: sales.length,
        docs: sales.map((d) => ({
          id: d.id,
          type: d.document_type,
          date: d.date,
          net: d.net_total,
          gross: d.gross_total,
          sign: salesRevenueSign(d.document_type),
        })),
      },
      expenses: {
        total_net: expenses,
        doc_count: purchases.length,
        docs: purchases.map((d) => ({
          id: d.id,
          type: d.document_type,
          date: d.date,
          net: d.net_total,
          gross: d.gross_total,
          sign: purchaseExpenseSign(d.document_type),
        })),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: "fetch", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
