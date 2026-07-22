/**
 * Catalogo de categorias de gasto do TOConline por tenant.
 *
 * - Sincronizacao AUTOMATICA e silenciosa: quando o catalogo esta' em falta ou
 *   desactualizado (> STALE_HOURS), e' refrescado a partir do TOConline sem o
 *   utilizador ter de fazer nada. Falhas nunca rebentam o caller.
 * - Exclusivo do modo toconline_direct (usa getValidToken).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getValidToken } from "@/lib/toconline/token"

export interface ExpenseCategory {
  code: string
  name: string
  tax_code: string | null
}

const STALE_HOURS = 24

type Row = {
  code: string
  name: string
  tax_code: string | null
  synced_at: string | null
}

/**
 * Busca o catalogo no TOConline e grava-o. Devolve as categorias gravadas.
 * Lanca em caso de falha (o caller decide se ignora).
 */
export async function syncExpenseCategories(
  tenantId: string,
  supabase: SupabaseClient,
): Promise<ExpenseCategory[]> {
  const t = await getValidToken(tenantId)
  const res = await fetch(`${t.appBase.replace(/\/$/, "")}/api/expense_categories`, {
    headers: { Authorization: `Bearer ${t.accessToken}`, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`TOConline expense_categories ${res.status}`)

  const body = await res.json()
  const items: { id?: string; attributes?: Record<string, unknown> }[] = Array.isArray(body?.data)
    ? body.data
    : []

  const now = new Date().toISOString()
  const rows = items
    .map((c) => {
      const a = c.attributes ?? {}
      return {
        tenant_id: tenantId,
        code: String(a.accounting_number ?? "").trim(),
        name: String(a.name ?? "").trim(),
        tax_code: (a.tax_code as string | null) ?? null,
        tax_deductibility:
          typeof a.tax_deductibility === "number" ? (a.tax_deductibility as number) : null,
        is_main: typeof a.is_main === "boolean" ? (a.is_main as boolean) : null,
        synced_at: now,
      }
    })
    .filter((r) => r.code && r.name)

  if (rows.length === 0) return []

  // Upsert em lotes (o catalogo pode ter algumas centenas de linhas)
  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from("toconline_expense_categories")
      .upsert(rows.slice(i, i + BATCH), { onConflict: "tenant_id,code" })
    if (error) throw new Error(`Erro a gravar categorias: ${error.message}`)
  }

  return rows.map((r) => ({ code: r.code, name: r.name, tax_code: r.tax_code }))
}

/**
 * Devolve o catalogo do tenant, sincronizando em silencio se estiver em falta
 * ou desactualizado. Nunca lanca: se o TOConline falhar, devolve o que houver
 * em cache (ou lista vazia).
 */
export async function getExpenseCategories(
  tenantId: string,
  supabase: SupabaseClient,
): Promise<ExpenseCategory[]> {
  const { data } = await supabase
    .from("toconline_expense_categories")
    .select("code, name, tax_code, synced_at")
    .eq("tenant_id", tenantId)
    .order("code", { ascending: true })

  const rows = (data ?? []) as Row[]

  const maisRecente = rows.reduce<number>((acc, r) => {
    const ts = r.synced_at ? new Date(r.synced_at).getTime() : 0
    return ts > acc ? ts : acc
  }, 0)
  const desactualizado = Date.now() - maisRecente > STALE_HOURS * 3600_000

  if (rows.length === 0 || desactualizado) {
    try {
      const frescas = await syncExpenseCategories(tenantId, supabase)
      if (frescas.length > 0) return frescas
    } catch {
      // Silencioso por design: usamos o que houver em cache.
    }
  }

  return rows.map((r) => ({ code: r.code, name: r.name, tax_code: r.tax_code }))
}
