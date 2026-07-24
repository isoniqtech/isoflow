/**
 * Sync de e-Fatura partilhado pelos dois modos (direto e n8n) e por dois
 * chamadores: a rota /api/efatura/refresh (botao manual) e o cron
 * /api/cron/efatura (dia 1 de cada mes).
 *
 * O fetch dos document_associations passa por tocRequest, que resolve o
 * transporte pelo integration_mode do tenant: direto (OAuth proprio) ou proxy
 * n8n (query crua via webhook). O processamento (upsert + reconciliacao
 * efatura_documents <-> invoices) e' identico nos dois modos - foi o que
 * permitiu apagar o workflow n8n gordo.
 */

import { createServiceClient } from "@/lib/supabase/server"
import { fetchDocumentAssociations } from "@/lib/integrations/toconline"

const AT_POSITIVE = ["compra_registada", "Associada", "doc_contabilidade"]

export interface EfaturaSyncResult {
  direct_fetched: number
  direct_created: number
  direct_updated: number
  matched: number
  at_communicated_updated: number
}

/**
 * Corre o sync completo para um tenant: busca os ultimos `months` meses de
 * document_associations, faz upsert em efatura_documents e reconcilia com
 * invoices (marcando at_communicated nos estados AT positivos).
 */
export async function runEfaturaSync(
  tenantId: string,
  months: number,
): Promise<EfaturaSyncResult> {
  const supabase = createServiceClient()

  let directFetched = 0
  let directCreated = 0
  let directUpdated = 0

  // ── A) Buscar dados frescos do TOConline (direto OU proxy n8n) ────────────
  const now = new Date()
  const ranges: Array<{ from: string; to: string }> = []
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const firstDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const lastDayStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`
    ranges.push({ from: firstDay, to: lastDayStr })
  }

  for (const range of ranges) {
    const docs = await fetchDocumentAssociations(tenantId, range.from, range.to)

    // Saber quais ja' existem (para distinguir novos de ja' existentes)
    const incomingIds = docs.filter((d) => d.document_number).map((d) => String(d.id))
    const existingIds = new Set<string>()
    if (incomingIds.length > 0) {
      const { data: existing } = await supabase
        .from("efatura_documents")
        .select("toconline_id")
        .eq("tenant_id", tenantId)
        .in("toconline_id", incomingIds)
      for (const r of existing ?? []) existingIds.add(r.toconline_id as string)
    }

    for (const doc of docs) {
      if (!doc.document_number) continue
      const toconlineId = String(doc.id)
      if (existingIds.has(toconlineId)) directUpdated++
      else directCreated++
      await supabase.from("efatura_documents").upsert(
        {
          tenant_id: tenantId,
          toconline_id: toconlineId,
          document_number: doc.document_number,
          document_date: doc.date,
          supplier_name: doc.supplier_name,
          supplier_nif: doc.supplier_nif,
          total: doc.total,
          currency: "EUR",
          at_status: doc.at_status,
          raw_data: doc as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,toconline_id", ignoreDuplicates: false },
      )
      directFetched++
    }
  }

  // ── B) Reconciliacao: efatura_documents <-> invoices ──────────────────────
  const { data: unmatchedDocs } = await supabase
    .from("efatura_documents")
    .select("id, supplier_nif, document_number, at_status, total")
    .eq("tenant_id", tenantId)
    .is("invoice_id", null)
    .not("document_number", "is", null)
    .limit(1000)

  let matched = 0
  let atUpdated = 0

  if (unmatchedDocs && unmatchedDocs.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, supplier_nif, invoice_number, toconline_fc_id, total, at_communicated")
      .eq("tenant_id", tenantId)
      .neq("status", "rejected")

    const invoicesByNif = new Map<string, typeof invoices>()
    for (const inv of invoices ?? []) {
      if (!inv.supplier_nif) continue
      const list = invoicesByNif.get(inv.supplier_nif) ?? []
      list.push(inv)
      invoicesByNif.set(inv.supplier_nif, list)
    }
    const allInvoices = invoices ?? []

    const efaturaUpdates: { id: string; invoice_id: string }[] = []
    const invoiceAtUpdates: string[] = []

    for (const doc of unmatchedDocs) {
      if (!doc.document_number) continue
      const docTotal = Number(doc.total ?? 0)

      const candidates = doc.supplier_nif
        ? (invoicesByNif.get(doc.supplier_nif) ?? [])
        : allInvoices

      const inv = candidates.find(
        (i) =>
          (i.invoice_number === doc.document_number || i.toconline_fc_id === doc.document_number) &&
          Math.abs(Number(i.total ?? 0) - docTotal) < 0.01,
      )
      if (!inv) continue

      efaturaUpdates.push({ id: doc.id, invoice_id: inv.id })
      matched++

      if (AT_POSITIVE.includes(doc.at_status ?? "") && !inv.at_communicated) {
        invoiceAtUpdates.push(inv.id)
        atUpdated++
      }
    }

    for (const u of efaturaUpdates) {
      await supabase
        .from("efatura_documents")
        .update({ invoice_id: u.invoice_id, matched_at: new Date().toISOString(), matched_by: "auto" })
        .eq("id", u.id)
    }

    if (invoiceAtUpdates.length > 0) {
      await supabase
        .from("invoices")
        .update({ at_communicated: true, at_communicated_at: new Date().toISOString() })
        .in("id", invoiceAtUpdates)
    }
  }

  // ── C) Garantir at_communicated nos docs ja' ligados (cleanup) ────────────
  const { data: linkedDocs } = await supabase
    .from("efatura_documents")
    .select("invoice_id, at_status")
    .eq("tenant_id", tenantId)
    .not("invoice_id", "is", null)
    .in("at_status", AT_POSITIVE)
    .limit(500)

  if (linkedDocs && linkedDocs.length > 0) {
    const linkedIds = linkedDocs.map((d) => d.invoice_id).filter(Boolean) as string[]
    const { data: linkedInvoices } = await supabase
      .from("invoices")
      .select("id, at_communicated")
      .in("id", linkedIds)
      .eq("at_communicated", false)

    if (linkedInvoices && linkedInvoices.length > 0) {
      await supabase
        .from("invoices")
        .update({ at_communicated: true, at_communicated_at: new Date().toISOString() })
        .in("id", linkedInvoices.map((i) => i.id))
      atUpdated += linkedInvoices.length
    }
  }

  return {
    direct_fetched: directFetched,
    direct_created: directCreated,
    direct_updated: directUpdated,
    matched,
    at_communicated_updated: atUpdated,
  }
}
