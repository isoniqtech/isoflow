import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

type Client = SupabaseClient<Database>

export type InvoiceForMatching = {
  id: string
  total: number
  invoice_date: string | null
  supplier_name: string | null
  supplier_nif: string | null
  invoice_number: string | null
}

export type BankTxForMatching = {
  id: string
  amount: number
  date: string
  description: string | null
  counterparty_name: string | null
  counterparty_iban: string | null
  bank_reference: string | null
}

export type MatchScore = {
  invoice_id: string
  bank_transaction_id: string
  score: number // 0..1
  signals: {
    amount_exact: boolean
    amount_close: boolean
    date_close: boolean
    nif_in_description: boolean
    supplier_in_text: boolean
    iban_match: boolean
    reference_match: boolean
  }
}

const TOTAL_POSSIBLE_POINTS = 170 // somatório dos pesos abaixo

const WEIGHTS = {
  amount_exact: 50,
  amount_close: 30, // só conta se amount_exact for false
  date_close: 30,
  nif_in_description: 20,
  supplier_in_text: 20,
  iban_match: 20,
  reference_match: 30,
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

/**
 * Calcula score de match entre uma fatura e um movimento bancário.
 * O sinal do amount: faturas a pagar (incoming) batem com movimentos negativos
 * (débitos do banco). Faturas emitidas (outgoing) batem com movimentos positivos.
 * Esta função compara em valor absoluto — direção é decidida pelo caller.
 *
 * Score final 0..1 (normalizado por max possível).
 */
export function calculateMatchScore(
  invoice: InvoiceForMatching,
  tx: BankTxForMatching,
): MatchScore {
  const invoiceAmt = Math.abs(invoice.total)
  const txAmt = Math.abs(tx.amount)
  const diff = Math.abs(invoiceAmt - txAmt)
  const tolerance = invoiceAmt * 0.02 // 2%

  const amount_exact = diff < 0.01
  const amount_close = !amount_exact && diff <= tolerance && tolerance > 0

  const date_close = invoice.invoice_date
    ? daysBetween(invoice.invoice_date, tx.date) <= 5
    : false

  // Texto a pesquisar (descrição + counterparty + reference)
  const haystack = normalize(
    [tx.description, tx.counterparty_name, tx.bank_reference].filter(Boolean).join(" "),
  )

  const supplierName = invoice.supplier_name
    ? normalize(invoice.supplier_name)
    : ""
  const supplierNif = invoice.supplier_nif

  const nif_in_description = Boolean(
    supplierNif && haystack.replace(/\s/g, "").includes(supplierNif),
  )

  const supplier_in_text = Boolean(
    supplierName.length >= 3 && haystack.includes(supplierName),
  )

  // IBAN match — só se ambos tiverem
  const iban_match = false // requereria invoice ter supplier_iban; CLAUDE.md schema não tem ainda

  // Reference match — número de fatura aparece em bank_reference ou descrição
  const invoiceNumber = invoice.invoice_number
    ? normalize(invoice.invoice_number).replace(/\s/g, "")
    : ""
  const refHaystack = normalize(
    [tx.bank_reference, tx.description, tx.counterparty_name]
      .filter(Boolean)
      .join(" "),
  ).replace(/\s/g, "")
  const reference_match = Boolean(
    invoiceNumber.length >= 3 && refHaystack.includes(invoiceNumber),
  )

  let points = 0
  if (amount_exact) points += WEIGHTS.amount_exact
  else if (amount_close) points += WEIGHTS.amount_close
  if (date_close) points += WEIGHTS.date_close
  if (nif_in_description) points += WEIGHTS.nif_in_description
  if (supplier_in_text) points += WEIGHTS.supplier_in_text
  if (iban_match) points += WEIGHTS.iban_match
  if (reference_match) points += WEIGHTS.reference_match

  const score = Math.min(1, points / TOTAL_POSSIBLE_POINTS)

  return {
    invoice_id: invoice.id,
    bank_transaction_id: tx.id,
    score,
    signals: {
      amount_exact,
      amount_close,
      date_close,
      nif_in_description,
      supplier_in_text,
      iban_match,
      reference_match,
    },
  }
}

export type RunReconciliationResult = {
  scanned_invoices: number
  scanned_transactions: number
  auto_confirmed: number
  suggestions: number
}

/**
 * Corre o engine para todos os pares (invoice não conciliada, transação sem match).
 * Para cada par calcula score:
 *  - score >= 0.95 → cria reconciliation com status='confirmed', match_type='auto'
 *    e atualiza invoice.status='matched' + bank_transactions.invoice_id
 *  - score >= 0.80 → cria reconciliation com status='pending' (sugestão para
 *    user confirmar manualmente). Não toca em invoice/bank ainda.
 *  - score < 0.80 → ignora
 *
 * Idempotente: usa unique constraint (invoice_id, bank_transaction_id) em
 * reconciliations. Se já existe, ignora.
 */
export async function runAutoReconciliation(
  supabase: Client,
  tenantId: string,
): Promise<RunReconciliationResult> {
  // Faturas elegíveis (incoming, não conciliada/paga/rejected/duplicate)
  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select(
      "id, total, invoice_date, supplier_name, supplier_nif, invoice_number, status, type",
    )
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "processing"])
    .eq("type", "incoming")
    .not("total", "is", null)

  // Movimentos sem invoice_id, não pendentes
  const { data: txRows } = await supabase
    .from("bank_transactions")
    .select(
      "id, amount, date, description, counterparty_name, counterparty_iban, bank_reference, external_status",
    )
    .eq("tenant_id", tenantId)
    .is("invoice_id", null)

  const invoices: InvoiceForMatching[] = (invoiceRows ?? [])
    .filter((i) => i.total !== null)
    .map((i) => ({
      id: i.id,
      total: Number(i.total),
      invoice_date: i.invoice_date,
      supplier_name: i.supplier_name,
      supplier_nif: i.supplier_nif,
      invoice_number: i.invoice_number,
    }))

  const txs: BankTxForMatching[] = (txRows ?? [])
    .filter((t) => t.external_status !== "PENDING")
    .map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      date: t.date,
      description: t.description,
      counterparty_name: t.counterparty_name,
      counterparty_iban: t.counterparty_iban,
      bank_reference: t.bank_reference,
    }))

  let auto_confirmed = 0
  let suggestions = 0

  // Greedy 1:1 — cada invoice e cada tx só pode aparecer numa reconciliation auto
  const usedInvoices = new Set<string>()
  const usedTxs = new Set<string>()

  // Calcular todos os scores e ordenar desc
  const candidates: MatchScore[] = []
  for (const inv of invoices) {
    for (const tx of txs) {
      // Faturas incoming pagam-se com débitos (amount < 0). Filtrar.
      if (tx.amount > 0) continue
      const score = calculateMatchScore(inv, tx)
      if (score.score >= 0.5) candidates.push(score)
    }
  }
  candidates.sort((a, b) => b.score - a.score)

  for (const c of candidates) {
    if (usedInvoices.has(c.invoice_id) || usedTxs.has(c.bank_transaction_id)) {
      continue
    }
    if (c.score >= 0.95) {
      // Auto-confirma
      const { error } = await supabase.from("reconciliations").insert({
        tenant_id: tenantId,
        invoice_id: c.invoice_id,
        bank_transaction_id: c.bank_transaction_id,
        match_type: "auto",
        match_score: Number(c.score.toFixed(2)),
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      if (!error) {
        await supabase
          .from("invoices")
          .update({
            status: "matched",
            bank_transaction_id: c.bank_transaction_id,
            matched_at: new Date().toISOString(),
            matched_by: "auto",
            match_score: Number(c.score.toFixed(2)),
          })
          .eq("id", c.invoice_id)
        await supabase
          .from("bank_transactions")
          .update({
            invoice_id: c.invoice_id,
            matched_at: new Date().toISOString(),
            matched_by: "auto",
          })
          .eq("id", c.bank_transaction_id)
        auto_confirmed += 1
        usedInvoices.add(c.invoice_id)
        usedTxs.add(c.bank_transaction_id)
      }
    } else if (c.score >= 0.8) {
      // Sugere — não toca em invoice/bank ainda
      const { error } = await supabase.from("reconciliations").insert({
        tenant_id: tenantId,
        invoice_id: c.invoice_id,
        bank_transaction_id: c.bank_transaction_id,
        match_type: "auto",
        match_score: Number(c.score.toFixed(2)),
        status: "pending",
      })
      if (!error) {
        suggestions += 1
        usedInvoices.add(c.invoice_id)
        usedTxs.add(c.bank_transaction_id)
      }
    }
  }

  return {
    scanned_invoices: invoices.length,
    scanned_transactions: txs.length,
    auto_confirmed,
    suggestions,
  }
}
