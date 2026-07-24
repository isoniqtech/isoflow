/**
 * Catalogo de categorias de gasto do TOConline por tenant.
 *
 * Duas origens, conforme o modo de integracao do tenant:
 *  - toconline_direct: o ISOFlow vai buscar a GET {appBase}/api/expense_categories
 *  - n8n:              o ISOFlow chama o webhook n8n do tenant, que devolve a lista
 *
 * A logica da app e' a mesma para todos: o catalogo fica na mesma tabela e e'
 * usado da mesma forma (decisao pela IA + escolha no detalhe da fatura).
 *
 * Sincronizacao AUTOMATICA e silenciosa: refresca quando esta' em falta ou
 * desactualizada (> STALE_HOURS). Falhas nunca rebentam o caller.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { tocRequest } from "@/lib/toconline/transport"

export interface ExpenseCategory {
  code: string
  name: string
  tax_code: string | null
}

const STALE_HOURS = 24

type Row = { code: string; name: string; tax_code: string | null; synced_at: string | null }
type Raw = Record<string, unknown>

/** Extrai a lista de categorias de varios formatos de resposta possiveis. */
function extrairLista(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  const o = (body ?? {}) as Raw
  for (const chave of ["categories", "categorias", "data", "items"]) {
    const v = o[chave]
    if (Array.isArray(v)) return v
    if (typeof v === "string") {
      try {
        const p = JSON.parse(v)
        if (Array.isArray(p)) return p
        const pd = (p as Raw)?.data
        if (Array.isArray(pd)) return pd
      } catch {
        // ignorar
      }
    }
  }
  return []
}

/**
 * Normaliza itens de qualquer origem. Aceita o formato cru do TOConline
 * ({attributes:{accounting_number,name,tax_code}}) e o formato simples
 * ({code,name,tax_code}).
 */
function normalizar(items: unknown[], tenantId: string, now: string) {
  return items
    .map((raw) => {
      const o = (raw ?? {}) as Raw
      const a = ((o.attributes ?? o) ?? {}) as Raw
      return {
        tenant_id: tenantId,
        code: String(a.code ?? a.accounting_number ?? "").trim(),
        name: String(a.name ?? a.description ?? "").trim(),
        tax_code: (a.tax_code as string | null) ?? null,
        tax_deductibility:
          typeof a.tax_deductibility === "number" ? (a.tax_deductibility as number) : null,
        is_main: typeof a.is_main === "boolean" ? (a.is_main as boolean) : null,
        synced_at: now,
      }
    })
    .filter((r) => r.code && r.name)
}

/**
 * Normaliza e grava um lote de categorias. Usado tanto pelo sync interno
 * (modo direto / pull n8n) como pelo webhook de push do n8n.
 * Devolve o numero de categorias gravadas.
 */
export async function storeCategories(
  tenantId: string,
  items: unknown[],
  supabase: SupabaseClient,
): Promise<number> {
  const rows = normalizar(items, tenantId, new Date().toISOString())
  if (rows.length === 0) return 0

  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from("toconline_expense_categories")
      .upsert(rows.slice(i, i + BATCH), { onConflict: "tenant_id,code" })
    if (error) throw new Error(`Erro a gravar categorias: ${error.message}`)
  }
  return rows.length
}

/** Reexportado para o webhook aceitar os mesmos formatos de payload. */
export { extrairLista }

/** Busca o catalogo ao TOConline via tocRequest (direto por OAuth; n8n pelo proxy). */
async function buscarNoToconline(tenantId: string): Promise<unknown[]> {
  const { status, body } = await tocRequest(tenantId, {
    base: "app",
    method: "GET",
    path: "/api/expense_categories",
  })
  if (status >= 400) throw new Error(`TOConline expense_categories ${status}`)
  return extrairLista(body)
}

/**
 * Sincroniza o catalogo a partir do TOConline. Os dois modos (direto e n8n)
 * buscam a lista de forma SINCRONA via tocRequest e gravam-na - o modo n8n
 * deixou de disparar um workflow e esperar pelo push a /api/webhooks/categorias.
 * Lanca em caso de falha (o caller decide se ignora).
 */
export async function syncExpenseCategories(
  tenantId: string,
  supabase: SupabaseClient,
): Promise<ExpenseCategory[]> {
  const items = await buscarNoToconline(tenantId)
  const rows = normalizar(items, tenantId, new Date().toISOString())
  if (rows.length === 0) return []

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
 * ou desactualizado. Nunca lanca: se a origem falhar, devolve a cache.
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
