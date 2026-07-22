/**
 * Decide e grava a categoria de gasto de uma fatura.
 *
 * Idempotente: se a fatura ja' tiver categoria, devolve-a sem fazer nada.
 * Silencioso: qualquer falha (catalogo indisponivel, IA em baixo) deixa a
 * categoria a null - o utilizador escolhe manualmente no detalhe da fatura.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getExpenseCategories } from "@/lib/toconline/expense-categories"
import { pickExpenseCategory } from "@/lib/claude/pick-expense-category"
import { resolveAnthropicConfig } from "@/lib/claude/extract-invoice"

export async function ensureInvoiceExpenseCategory(
  invoiceId: string,
  tenantId: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  try {
    const { data: inv } = await supabase
      .from("invoices")
      .select("expense_category_code, supplier_name, description, category, total, vat_rate")
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (!inv) return null

    const row = inv as {
      expense_category_code?: string | null
      supplier_name?: string | null
      description?: string | null
      category?: string | null
      total?: number | string | null
      vat_rate?: number | string | null
    }

    if (row.expense_category_code) return row.expense_category_code

    const categorias = await getExpenseCategories(tenantId, supabase)
    if (categorias.length === 0) return null

    const aiConfig = await resolveAnthropicConfig(tenantId, supabase)
    const escolhido = await pickExpenseCategory(
      {
        supplier_name: row.supplier_name ?? null,
        description: row.description ?? null,
        category: row.category ?? null,
        total: row.total !== null && row.total !== undefined ? Number(row.total) : null,
        vat_rate: row.vat_rate !== null && row.vat_rate !== undefined ? Number(row.vat_rate) : null,
      },
      categorias,
      aiConfig,
    )

    if (!escolhido) return null

    await supabase
      .from("invoices")
      .update({ expense_category_code: escolhido })
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)

    return escolhido
  } catch {
    return null
  }
}
