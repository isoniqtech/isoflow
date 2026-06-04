import type { SupabaseClient } from "@supabase/supabase-js"

const AT_POSITIVE = ["compra_registada", "Associada", "doc_contabilidade"]

/**
 * Tenta associar uma fatura recém-criada a um documento e-Fatura existente.
 * Critérios: NIF + número de documento + total (tolerância 0.01€).
 * Se encontrar: liga os dois registos e marca at_communicated na fatura se estado AT positivo.
 */
export async function reconcileInvoiceWithEFatura(
  supabase: SupabaseClient,
  invoice: {
    id: string
    supplier_nif: string | null
    invoice_number: string | null
    total: number | null
  },
  tenantId: string,
): Promise<boolean> {
  if (!invoice.invoice_number || invoice.total === null) {
    return false
  }

  // Procurar documento e-Fatura não associado — se houver NIF filtra por NIF, senão só por número
  let query = supabase
    .from("efatura_documents")
    .select("id, at_status, total")
    .eq("tenant_id", tenantId)
    .is("invoice_id", null)
    .eq("document_number", invoice.invoice_number)

  if (invoice.supplier_nif) {
    query = query.eq("supplier_nif", invoice.supplier_nif)
  }

  const { data: efaturaDocs } = await query.limit(5)

  if (!efaturaDocs?.length) return false

  // Verificar valor dentro da tolerância
  const invoiceTotal = Number(invoice.total)
  const match = efaturaDocs.find(
    (doc) => Math.abs(Number(doc.total ?? 0) - invoiceTotal) < 0.01,
  )
  if (!match) return false

  const now = new Date().toISOString()

  // Ligar os dois registos
  await supabase
    .from("efatura_documents")
    .update({ invoice_id: invoice.id, matched_at: now, matched_by: "auto" })
    .eq("id", match.id)

  // Marcar at_communicated na fatura se estado AT positivo
  if (AT_POSITIVE.includes(match.at_status ?? "")) {
    await supabase
      .from("invoices")
      .update({ at_communicated: true, at_communicated_at: now })
      .eq("id", invoice.id)
  }

  return true
}
