import { createClient } from "@/lib/supabase/server"
import type {
  InvoiceFileType,
  InvoiceMatchedBy,
  InvoiceSource,
  InvoiceStatus,
  InvoiceType,
} from "@/types"

export type InvoiceDetail = {
  id: string
  type: InvoiceType
  status: InvoiceStatus
  source: InvoiceSource
  supplier_name: string | null
  supplier_nif: string | null
  supplier_email: string | null
  supplier_address: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  vat_rate: number | null
  vat_amount: number | null
  total: number | null
  currency: string
  description: string | null
  category: string | null
  notes: string | null
  needs_review: boolean
  ai_confidence: number | null
  matched_at: string | null
  matched_by: InvoiceMatchedBy | null
  file_path: string | null
  file_name: string | null
  file_type: InvoiceFileType | null
  erp_synced: boolean
  erp_synced_at: string | null
  at_communicated: boolean
  at_communicated_at: string | null
  project: { id: string; name: string; color: string } | null
  // Notas de credito (NCF)
  document_kind: "invoice" | "credit_note"
  related_invoice_id: string | null
  referenced_document_number: string | null
  // Fatura original que esta nota de credito credita (quando ligada)
  related_invoice: { id: string; invoice_number: string | null; supplier_name: string | null } | null
  // Notas de credito que apontam para esta fatura (quando e' uma fatura)
  credit_notes: Array<{ id: string; invoice_number: string | null; total: number | null }>
  created_at: string
  updated_at: string
}

export async function getInvoiceDetail(
  id: string,
  tenantId: string,
  options?: { restrictToCreatedBy?: string },
): Promise<InvoiceDetail | null> {
  const supabase = createClient()

  let query = supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)

  if (options?.restrictToCreatedBy) {
    query = query.eq("created_by", options.restrictToCreatedBy)
  }

  const { data: invoice } = await query.maybeSingle()
  if (!invoice) return null

  let project: InvoiceDetail["project"] = null
  if (invoice.project_id) {
    const { data: p } = await supabase
      .from("projects")
      .select("id, name, color")
      .eq("id", invoice.project_id)
      .maybeSingle()
    if (p) {
      project = { id: p.id, name: p.name, color: p.color ?? "#2563EB" }
    }
  }

  const documentKind =
    (invoice as { document_kind?: string | null }).document_kind === "credit_note"
      ? "credit_note"
      : "invoice"
  const relatedInvoiceId =
    (invoice as { related_invoice_id?: string | null }).related_invoice_id ?? null
  const referencedDocumentNumber =
    (invoice as { referenced_document_number?: string | null }).referenced_document_number ?? null

  // Nota de credito -> a fatura original que credita
  let relatedInvoice: InvoiceDetail["related_invoice"] = null
  if (documentKind === "credit_note" && relatedInvoiceId) {
    const { data: orig } = await supabase
      .from("invoices")
      .select("id, invoice_number, supplier_name")
      .eq("id", relatedInvoiceId)
      .eq("tenant_id", tenantId)
      .maybeSingle()
    if (orig) {
      relatedInvoice = {
        id: orig.id,
        invoice_number: orig.invoice_number,
        supplier_name: orig.supplier_name,
      }
    }
  }

  // Fatura -> notas de credito que apontam para ela
  let creditNotes: InvoiceDetail["credit_notes"] = []
  if (documentKind === "invoice") {
    const { data: cns } = await supabase
      .from("invoices")
      .select("id, invoice_number, total")
      .eq("tenant_id", tenantId)
      .eq("related_invoice_id", invoice.id)
      .eq("document_kind", "credit_note")
    creditNotes = (cns ?? []).map((c) => ({
      id: c.id,
      invoice_number: c.invoice_number,
      total: c.total !== null ? Number(c.total) : null,
    }))
  }

  return {
    id: invoice.id,
    type: (invoice.type ?? "incoming") as InvoiceType,
    status: (invoice.status ?? "pending") as InvoiceStatus,
    source: (invoice.source ?? "manual") as InvoiceSource,
    supplier_name: invoice.supplier_name,
    supplier_nif: invoice.supplier_nif,
    supplier_email: invoice.supplier_email,
    supplier_address: invoice.supplier_address,
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    subtotal: invoice.subtotal !== null ? Number(invoice.subtotal) : null,
    vat_rate: invoice.vat_rate !== null ? Number(invoice.vat_rate) : null,
    vat_amount: invoice.vat_amount !== null ? Number(invoice.vat_amount) : null,
    total: invoice.total !== null ? Number(invoice.total) : null,
    currency: invoice.currency ?? "EUR",
    description: invoice.description,
    category: invoice.category,
    notes: invoice.notes,
    needs_review: invoice.needs_review ?? false,
    ai_confidence:
      invoice.ai_confidence !== null ? Number(invoice.ai_confidence) : null,
    matched_at: invoice.matched_at,
    matched_by: invoice.matched_by as InvoiceMatchedBy | null,
    file_path: invoice.file_path,
    file_name: invoice.file_name,
    file_type: invoice.file_type as InvoiceFileType | null,
    erp_synced: invoice.erp_synced ?? false,
    erp_synced_at: invoice.erp_synced_at,
    at_communicated: invoice.at_communicated ?? false,
    at_communicated_at: invoice.at_communicated_at,
    project,
    document_kind: documentKind,
    related_invoice_id: relatedInvoiceId,
    referenced_document_number: referencedDocumentNumber,
    related_invoice: relatedInvoice,
    credit_notes: creditNotes,
    created_at: invoice.created_at ?? new Date().toISOString(),
    updated_at: invoice.updated_at ?? new Date().toISOString(),
  }
}
