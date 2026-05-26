import type { Invoice } from "@/types"

export interface TOCOnlineDocument {
  id: number
  document_type: string
  date: string
  document_number: string
  total: number
  subtotal: number
  vat_total: number
  communication_status?: string
  supplier_tax_registration_number?: string
  supplier_business_name?: string
  client_tax_registration_number?: string
  client_business_name?: string
}

type DateFilters = { dateFrom?: string; dateTo?: string }

async function fetchDocuments(
  accessToken: string,
  baseUrl: string,
  endpoint: string,
  filters?: DateFilters,
): Promise<TOCOnlineDocument[]> {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}${endpoint}`)
  if (filters?.dateFrom) url.searchParams.set("date_from", filters.dateFrom)
  if (filters?.dateTo) url.searchParams.set("date_to", filters.dateTo)

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })

  if (!res.ok) {
    throw new Error(`TOConline API error ${res.status}: ${await res.text()}`)
  }

  const body = await res.json()
  return Array.isArray(body) ? body : (body.data ?? body.documents ?? [])
}

export async function fetchPurchaseDocuments(
  accessToken: string,
  baseUrl: string,
  filters?: DateFilters,
): Promise<TOCOnlineDocument[]> {
  return fetchDocuments(
    accessToken,
    baseUrl,
    "/api/v1/commercial_purchases_documents",
    filters,
  )
}

export async function fetchSalesDocuments(
  accessToken: string,
  baseUrl: string,
  filters?: DateFilters,
): Promise<TOCOnlineDocument[]> {
  return fetchDocuments(
    accessToken,
    baseUrl,
    "/api/v1/commercial_sales_documents",
    filters,
  )
}

export async function sendDocumentToAT(
  accessToken: string,
  baseUrl: string,
  documentId: string,
  invoiceType: "incoming" | "outgoing",
): Promise<void> {
  const segment =
    invoiceType === "incoming"
      ? "commercial_purchases_documents"
      : "commercial_sales_documents"
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/${segment}/${documentId}/send_document_at_webservice`
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    throw new Error(`TOConline AT error ${res.status}: ${await res.text()}`)
  }
}

export function mapTOCDocumentToInvoice(
  doc: TOCOnlineDocument,
  tenantId: string,
  invoiceType: "incoming" | "outgoing",
): Partial<Invoice> {
  return {
    tenant_id: tenantId,
    type: invoiceType,
    source: "erp",
    erp_document_id: doc.id.toString(),
    erp_synced: true,
    erp_synced_at: new Date().toISOString(),
    at_communicated: doc.communication_status === "sent",
    at_communicated_at:
      doc.communication_status === "sent" ? new Date().toISOString() : null,
    invoice_number: doc.document_number ?? null,
    invoice_date: doc.date ?? null,
    total: doc.total ?? null,
    subtotal: doc.subtotal ?? null,
    vat_amount: doc.vat_total ?? null,
    supplier_name:
      invoiceType === "incoming"
        ? (doc.supplier_business_name ?? null)
        : (doc.client_business_name ?? null),
    supplier_nif:
      invoiceType === "incoming"
        ? (doc.supplier_tax_registration_number ?? null)
        : (doc.client_tax_registration_number ?? null),
    status: "pending",
    currency: "EUR",
  }
}
