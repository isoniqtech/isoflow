/**
 * Sync de snapshots mensais (receita + gastos) partilhado pelos dois modos
 * (direto e n8n) e por dois chamadores:
 *   - import-historico (backfill 2025 -> hoje, um clique)
 *   - cron sync-revenue (manutencao: mes corrente + sweep do mes anterior no dia 1)
 *
 * A leitura das vendas/compras passa por fetchDocsNetByDate -> tocRequest, que
 * resolve o transporte pelo integration_mode. O calculo e' o mesmo dos dois
 * modos e substitui os workflows n8n de receita/gastos, que somavam net_total
 * de TODOS os documentos sem o sinal do tipo:
 *   receita = soma(FR+FT+FS) - soma(NC)
 *   gasto   = soma(FC/DSP/FCA/SIF/NDF) - soma(NCF)
 * (o salesRevenueSign / purchaseExpenseSign fazem o sinal; os workflows nao o
 *  faziam - inflacionavam com as notas de credito - e nao paginavam.)
 */

import { createServiceClient } from "@/lib/supabase/server"
import {
  salesRevenueSign,
  purchaseExpenseSign,
  REVENUE_DOC_TYPES,
  EXPENSE_DOC_TYPES_ALL,
} from "@/lib/integrations/toconline"
import { fetchDocsNetByDate } from "@/lib/integrations/toconline-daterange"

export interface SnapshotSyncResult {
  months_processed: number
  errors: string[]
}

// Lista de {year, month} de `from` ate `to` (ambos "YYYY-MM-DD"), inclusive.
function monthRange(from: string, to: string): Array<{ year: number; month: number }> {
  const [fy, fm] = from.split("-").map(Number)
  const [ty, tm] = to.split("-").map(Number)
  const out: Array<{ year: number; month: number }> = []
  let y = fy
  let m = fm
  while (y < ty || (y === ty && m <= tm)) {
    out.push({ year: y, month: m })
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/**
 * Le vendas + compras do TOConline no intervalo [from, to], agrupa por mes e
 * grava monthly_snapshots (revenue + expenses). Atualiza tambem a cache de
 * receita do tenant para o mes corrente, se estiver no intervalo.
 */
export async function runSnapshotSync(
  tenantId: string,
  from: string,
  to: string,
): Promise<SnapshotSyncResult> {
  const svc = createServiceClient()

  const [sales, purchases] = await Promise.all([
    fetchDocsNetByDate(tenantId, "commercial_sales_documents", from, to, REVENUE_DOC_TYPES),
    fetchDocsNetByDate(tenantId, "commercial_purchases_documents", from, to, EXPENSE_DOC_TYPES_ALL),
  ])

  const salesByMonth = new Map<string, number>()
  const purchasesByMonth = new Map<string, number>()
  for (const d of sales) {
    const key = d.date?.slice(0, 7)
    if (!key || key.length !== 7) continue
    salesByMonth.set(key, (salesByMonth.get(key) ?? 0) + salesRevenueSign(d.document_type) * d.net_total)
  }
  for (const d of purchases) {
    const key = d.date?.slice(0, 7)
    if (!key || key.length !== 7) continue
    purchasesByMonth.set(key, (purchasesByMonth.get(key) ?? 0) + purchaseExpenseSign(d.document_type) * d.net_total)
  }

  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear = now.getFullYear()
  const savedAt = now.toISOString()

  let processed = 0
  const errors: string[] = []

  for (const { year, month } of monthRange(from, to)) {
    const key = `${year}-${String(month).padStart(2, "0")}`
    const revenue = Math.round((salesByMonth.get(key) ?? 0) * 100) / 100
    const expenses = Math.round((purchasesByMonth.get(key) ?? 0) * 100) / 100

    try {
      await svc.from("monthly_snapshots").upsert(
        { tenant_id: tenantId, month, year, revenue, expenses, saved_at: savedAt },
        { onConflict: "tenant_id,month,year" },
      )
      // Cache de receita do tenant: so' o mes corrente
      if (month === curMonth && year === curYear) {
        await svc
          .from("tenants")
          .update({
            toconline_revenue_total: revenue,
            toconline_revenue_month: month,
            toconline_revenue_year: year,
            toconline_revenue_cached_at: savedAt,
          })
          .eq("id", tenantId)
      }
      processed++
    } catch (e) {
      errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { months_processed: processed, errors }
}
