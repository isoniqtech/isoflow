import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

type Client = SupabaseClient<Database>

export type DebitCreditsResult =
  | { ok: true; balance_after: number }
  | { ok: false; reason: "insufficient_funds"; balance: number }
  | { ok: false; reason: "tenant_not_found" }
  | { ok: false; reason: "db_error"; message: string }

/**
 * Debita N créditos ao tenant. Atómico no sentido em que verifica saldo
 * e só desconta se houver — mas não usa transação SQL (Supabase JS não
 * expõe transactions). Race conditions: para o nosso volume é aceitável.
 *
 * Para tornar 100% atómico no futuro: criar função RPC `debit_credits`
 * em SQL com SELECT FOR UPDATE.
 */
export async function debitCredits(
  supabase: Client,
  params: {
    tenantId: string
    amount: number
    description: string
    referenceId?: string | null
    referenceType?: string | null
  },
): Promise<DebitCreditsResult> {
  const { tenantId, amount, description, referenceId, referenceType } = params

  const { data: tenant, error: fetchErr } = await supabase
    .from("tenants")
    .select("credits_balance, credits_used_this_month")
    .eq("id", tenantId)
    .maybeSingle()

  if (fetchErr) return { ok: false, reason: "db_error", message: fetchErr.message }
  if (!tenant) return { ok: false, reason: "tenant_not_found" }

  const balance = tenant.credits_balance ?? 0
  if (balance < amount) {
    return { ok: false, reason: "insufficient_funds", balance }
  }

  const newBalance = balance - amount
  const newUsed = (tenant.credits_used_this_month ?? 0) + amount

  const { error: updateErr } = await supabase
    .from("tenants")
    .update({
      credits_balance: newBalance,
      credits_used_this_month: newUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId)
  if (updateErr) return { ok: false, reason: "db_error", message: updateErr.message }

  await supabase.from("credit_transactions").insert({
    tenant_id: tenantId,
    amount: -amount,
    type: "usage",
    description,
    reference_id: referenceId ?? null,
    reference_type: referenceType ?? null,
    balance_after: newBalance,
  })

  return { ok: true, balance_after: newBalance }
}

/**
 * Verifica se o tenant tem pelo menos N créditos disponíveis (sem debitar).
 */
export async function hasCredits(
  supabase: Client,
  tenantId: string,
  amount: number,
): Promise<boolean> {
  const { data } = await supabase
    .from("tenants")
    .select("credits_balance")
    .eq("id", tenantId)
    .maybeSingle()
  return (data?.credits_balance ?? 0) >= amount
}
