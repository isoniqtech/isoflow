import { createClient } from "@/lib/supabase/server"
import type { UserRole, InvoiceStatus, InvoiceSource } from "@/types"

export type EFaturaDocument = {
  id: string
  toconline_id: string | null
  at_document_id: string | null
  document_number: string | null
  document_date: string | null
  supplier_nif: string | null
  supplier_name: string | null
  total: number | null
  subtotal: number | null
  vat_amount: number | null
  currency: string
  at_status: string | null
  invoice_id: string | null
  invoice_number: string | null
  matched_at: string | null
  matched_by: "auto" | "manual" | null
}

export type EFaturaInvoiceItem = {
  id: string
  supplier_name: string | null
  supplier_nif: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number | null
  currency: string
  status: InvoiceStatus
  source: InvoiceSource
  toconline_fc_id: string | null
  at_communicated: boolean
  // from efatura_documents join
  efatura_doc_id: string | null
  efatura_doc_number: string | null
  efatura_at_status: string | null
}

export type EFaturaPageData = {
  // Todas as faturas incoming com estado AT (join efatura_documents)
  invoices: EFaturaInvoiceItem[]
  // Documentos e-Fatura do AT não conciliados (lado direito)
  efatura_docs: EFaturaDocument[]
  // Documentos e-Fatura já conciliados (arquivo)
  efatura_docs_matched: EFaturaDocument[]
}

export async function listEFaturaPageData(
  tenantId: string,
  role: UserRole,
  userId: string,
): Promise<EFaturaPageData> {
  const supabase = createClient()

  const [invoicesRes, efaturaDocsRes, efaturaDocsMatchedRes] = await Promise.all([
    // Todas as faturas incoming com join ao efatura_documents
    supabase.rpc("get_invoices_with_efatura", { p_tenant_id: tenantId, p_user_id: role === "member" ? userId : null }),

    // Todos os docs e-Fatura (conciliados e por conciliar)
    supabase
      .from("efatura_documents")
      .select("id, toconline_id, at_document_id, document_number, document_date, supplier_nif, supplier_name, total, subtotal, vat_amount, currency, at_status, invoice_id, matched_at, matched_by, invoice:invoices(invoice_number)")
      .eq("tenant_id", tenantId)
      .order("document_date", { ascending: false })
      .limit(500),

    // Placeholder — já não usamos a lista separada de conciliados
    Promise.resolve({ data: [] }),
  ])

  const mapDoc = (d: Record<string, unknown>): EFaturaDocument => ({
    id: d.id as string,
    toconline_id: (d.toconline_id as string | null) ?? null,
    at_document_id: (d.at_document_id as string | null) ?? null,
    document_number: (d.document_number as string | null) ?? null,
    document_date: (d.document_date as string | null) ?? null,
    supplier_nif: (d.supplier_nif as string | null) ?? null,
    supplier_name: (d.supplier_name as string | null) ?? null,
    total: d.total !== null ? Number(d.total) : null,
    subtotal: d.subtotal !== null ? Number(d.subtotal) : null,
    vat_amount: d.vat_amount !== null ? Number(d.vat_amount) : null,
    currency: (d.currency as string) ?? "EUR",
    at_status: (d.at_status as string | null) ?? null,
    invoice_id: (d.invoice_id as string | null) ?? null,
    invoice_number: (() => {
      const j = Array.isArray(d.invoice) ? d.invoice[0] : d.invoice
      return ((j as { invoice_number?: string | null } | null)?.invoice_number) ?? null
    })(),
    matched_at: (d.matched_at as string | null) ?? null,
    matched_by: (d.matched_by as "auto" | "manual" | null) ?? null,
  })

  const invoices: EFaturaInvoiceItem[] = (invoicesRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    supplier_name: (r.supplier_name as string | null) ?? null,
    supplier_nif: (r.supplier_nif as string | null) ?? null,
    invoice_number: (r.invoice_number as string | null) ?? null,
    invoice_date: (r.invoice_date as string | null) ?? null,
    total: r.total !== null ? Number(r.total) : null,
    currency: (r.currency as string) ?? "EUR",
    status: (r.status as InvoiceStatus),
    source: (r.source as InvoiceSource),
    toconline_fc_id: (r.toconline_fc_id as string | null) ?? null,
    at_communicated: (r.at_communicated as boolean) ?? false,
    efatura_doc_id: (r.efatura_doc_id as string | null) ?? null,
    efatura_doc_number: (r.efatura_doc_number as string | null) ?? null,
    efatura_at_status: (r.efatura_at_status as string | null) ?? null,
  }))

  return {
    invoices,
    efatura_docs: (efaturaDocsRes.data ?? []).map(d => mapDoc(d as Record<string, unknown>)),
    efatura_docs_matched: (efaturaDocsMatchedRes.data ?? []).map(d => mapDoc(d as Record<string, unknown>)),
  }
}

// Keep for backward compat — used in faturas/page.tsx com_fc count
export type { EFaturaInvoiceItem as InvoiceListItemWithEFatura }
