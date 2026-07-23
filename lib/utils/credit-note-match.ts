import type { SupabaseClient } from "@supabase/supabase-js"

// Matching FC<->NCF DENTRO da app (o TOConline nao liga a NCF ao FC - ver
// migration 047 e o handoff das notas de credito). A ligacao serve a UI e o
// calculo dos gastos (gasto = soma FC - soma NCF).

// Normaliza um numero de documento para comparar: sem espacos, maiusculas.
function normaliseDocNo(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "").toUpperCase()
}

export interface MatchableInvoice {
  id: string
  tenant_id: string
  document_kind?: string | null
  referenced_document_number?: string | null
  invoice_number?: string | null
  supplier_nif?: string | null
}

type Candidate = {
  id: string
  invoice_number: string | null
  supplier_nif: string | null
  referenced_document_number: string | null
}

/**
 * Liga uma nota de credito (credit_note) a fatura de compra original.
 * So corre para credit_note com referenced_document_number preenchido. Procura,
 * no mesmo tenant, uma fatura (document_kind='invoice') cujo invoice_number bata
 * certo com o referenced_document_number (normalizado) e, quando a NCF tem NIF,
 * o mesmo supplier_nif. Grava related_invoice_id e devolve o id ligado (ou null).
 */
export async function matchCreditNoteToInvoice(
  supabase: SupabaseClient,
  creditNote: MatchableInvoice,
): Promise<string | null> {
  if (creditNote.document_kind !== "credit_note") return null
  const ref = normaliseDocNo(creditNote.referenced_document_number)
  if (!ref) return null

  let q = supabase
    .from("invoices")
    .select("id, invoice_number, supplier_nif, referenced_document_number")
    .eq("tenant_id", creditNote.tenant_id)
    .eq("document_kind", "invoice")
    .not("invoice_number", "is", null)
  if (creditNote.supplier_nif) q = q.eq("supplier_nif", creditNote.supplier_nif)

  const { data } = await q.limit(200)
  const rows = (data ?? []) as Candidate[]
  const match = rows.find((inv) => normaliseDocNo(inv.invoice_number) === ref)
  if (!match) return null

  await supabase
    .from("invoices")
    .update({ related_invoice_id: match.id })
    .eq("id", creditNote.id)
    .eq("tenant_id", creditNote.tenant_id)
  return match.id
}

/**
 * Matching inverso: ao entrar uma fatura nova, liga as notas de credito "por
 * associar" (related_invoice_id NULL) que a referenciam (mesmo numero, e mesmo
 * NIF quando a fatura o tem). Devolve os ids das NCF ligadas.
 */
export async function matchPendingCreditNotesToInvoice(
  supabase: SupabaseClient,
  invoice: MatchableInvoice,
): Promise<string[]> {
  if (invoice.document_kind === "credit_note") return []
  const num = normaliseDocNo(invoice.invoice_number)
  if (!num) return []

  let q = supabase
    .from("invoices")
    .select("id, invoice_number, supplier_nif, referenced_document_number")
    .eq("tenant_id", invoice.tenant_id)
    .eq("document_kind", "credit_note")
    .is("related_invoice_id", null)
    .not("referenced_document_number", "is", null)
  if (invoice.supplier_nif) q = q.eq("supplier_nif", invoice.supplier_nif)

  const { data } = await q.limit(200)
  const rows = (data ?? []) as Candidate[]
  const ids = rows
    .filter((cn) => normaliseDocNo(cn.referenced_document_number) === num)
    .map((cn) => cn.id)
  if (ids.length === 0) return []

  await supabase
    .from("invoices")
    .update({ related_invoice_id: invoice.id })
    .in("id", ids)
    .eq("tenant_id", invoice.tenant_id)
  return ids
}
