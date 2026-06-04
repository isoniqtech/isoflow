import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"

export const runtime = "nodejs"
export const maxDuration = 60

const AT_POSITIVE = ["compra_registada", "Associada", "doc_contabilidade"]

export async function POST() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "edit")) return jsonError("Forbidden", 403)

  const { createServiceClient } = await import("@/lib/supabase/server")
  const supabase = createServiceClient()

  // ── A) Disparar n8n para ir buscar dados frescos ─────────────────────────
  const n8nUrl = process.env.EFATURA_SYNC_WEBHOOK_URL
  let n8nTriggered = false
  let n8nError: string | null = null

  if (n8nUrl) {
    try {
      const n8nRes = await fetch(n8nUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: ctx.tenantId }),
        signal: AbortSignal.timeout(15000),
      })
      n8nTriggered = n8nRes.ok
      if (!n8nRes.ok) n8nError = `n8n HTTP ${n8nRes.status}`
    } catch (e) {
      n8nError = e instanceof Error ? e.message : "n8n timeout"
    }
  }

  // ── B) Reconciliação: efatura_documents ↔ invoices ───────────────────────
  // 1. Buscar todos os docs sem invoice_id e com NIF
  const { data: unmatchedDocs } = await supabase
    .from("efatura_documents")
    .select("id, supplier_nif, document_number, at_status")
    .eq("tenant_id", ctx.tenantId)
    .is("invoice_id", null)
    .not("supplier_nif", "is", null)
    .not("document_number", "is", null)
    .limit(1000)

  let matched = 0
  let atUpdated = 0

  if (unmatchedDocs && unmatchedDocs.length > 0) {
    // 2. Buscar invoices com os NIFs relevantes (batch)
    const nifs = [...new Set(unmatchedDocs.map(d => d.supplier_nif).filter(Boolean))] as string[]
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, supplier_nif, invoice_number, toconline_fc_id, at_communicated")
      .eq("tenant_id", ctx.tenantId)
      .in("supplier_nif", nifs)
      .neq("status", "rejected")

    const invoicesByNif = new Map<string, typeof invoices>()
    for (const inv of invoices ?? []) {
      if (!inv.supplier_nif) continue
      const list = invoicesByNif.get(inv.supplier_nif) ?? []
      list.push(inv)
      invoicesByNif.set(inv.supplier_nif, list)
    }

    // 3. Fazer match em memória e batch update
    const efaturaUpdates: { id: string; invoice_id: string }[] = []
    const invoiceAtUpdates: string[] = []

    for (const doc of unmatchedDocs) {
      if (!doc.supplier_nif || !doc.document_number) continue
      const candidates = invoicesByNif.get(doc.supplier_nif) ?? []
      const inv = candidates.find(
        i =>
          i.invoice_number === doc.document_number ||
          i.toconline_fc_id === doc.document_number,
      )
      if (!inv) continue

      efaturaUpdates.push({ id: doc.id, invoice_id: inv.id })
      matched++

      if (AT_POSITIVE.includes(doc.at_status ?? "") && !inv.at_communicated) {
        invoiceAtUpdates.push(inv.id)
        atUpdated++
      }
    }

    // 4. Persistir
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

  // 5. Garantir at_communicated nos docs já ligados (cleanup)
  const { data: linkedDocs } = await supabase
    .from("efatura_documents")
    .select("invoice_id, at_status")
    .eq("tenant_id", ctx.tenantId)
    .not("invoice_id", "is", null)
    .in("at_status", AT_POSITIVE)
    .limit(500)

  if (linkedDocs && linkedDocs.length > 0) {
    const linkedIds = linkedDocs.map(d => d.invoice_id).filter(Boolean) as string[]
    const { data: linkedInvoices } = await supabase
      .from("invoices")
      .select("id, at_communicated")
      .in("id", linkedIds)
      .eq("at_communicated", false)

    if (linkedInvoices && linkedInvoices.length > 0) {
      await supabase
        .from("invoices")
        .update({ at_communicated: true, at_communicated_at: new Date().toISOString() })
        .in("id", linkedInvoices.map(i => i.id))
      atUpdated += linkedInvoices.length
    }
  }

  return Response.json({
    n8n_triggered: n8nTriggered,
    n8n_error: n8nError,
    matched,
    at_communicated_updated: atUpdated,
  })
}
