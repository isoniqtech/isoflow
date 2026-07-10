import type { Invoice } from "@/types"

export interface TOCOnlineDocument {
  id: number
  document_type: string
  date: string
  document_number: string
  total: number
  net_total?: number
  subtotal: number
  vat_total: number
  communication_status?: string
  supplier_tax_registration_number?: string
  supplier_business_name?: string
  client_tax_registration_number?: string
  client_business_name?: string
}

type DateFilters = { dateFrom?: string; dateTo?: string }

// ---------------------------------------------------------------------------
// URL builders - subdominio dinamico por tenant
// app{N} = UI/auth/alguns endpoints de listagem
// api{N} = endpoints REST principais
// ---------------------------------------------------------------------------

export function buildAppUrl(subdomain: string | number, path: string): string {
  return `https://app${subdomain}.toconline.pt${path}`
}

export function buildApiUrl(subdomain: string | number, path: string): string {
  return `https://api${subdomain}.toconline.pt${path}`
}

// Retorna a base URL da app a partir da config do tenant.
// Aceita subdomain (novo) ou base_url (legado). Preferencia ao subdomain.
export function resolveBaseUrl(config: Record<string, unknown>): {
  appBase: string
  apiBase: string
} {
  const subdomain = config.subdomain as string | number | undefined
  if (subdomain) {
    return {
      appBase: `https://app${subdomain}.toconline.pt`,
      apiBase: `https://api${subdomain}.toconline.pt`,
    }
  }
  const base = (config.base_url as string | undefined) ?? "https://app.toconline.pt"
  return { appBase: base, apiBase: base }
}

// ---------------------------------------------------------------------------
// Fetch interno
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// e-Fatura list - endpoint especifico com filtros encodeados em duplas aspas.
// Resposta vem como string JSON aninhada em .data que precisa de JSON.parse.
// ---------------------------------------------------------------------------

export interface EFaturaItem {
  id: number
  document_type: string
  document_number: string
  date: string
  total: number
  net_total?: number
  communication_status?: string
  supplier_tax_registration_number?: string
  supplier_business_name?: string
  toconline_fc_id?: string
  external_reference?: string
}

export async function fetchEFaturaList(
  accessToken: string,
  appBase: string,
  filter?: string,
): Promise<EFaturaItem[]> {
  const url = new URL(
    `${appBase.replace(/\/$/, "")}/api/commercial_purchases_documents_list_for_invoices`,
  )
  if (filter) {
    url.searchParams.set("filter", filter)
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })

  if (!res.ok) {
    throw new Error(`TOConline e-fatura list error ${res.status}: ${await res.text()}`)
  }

  const body = await res.json()

  // Resposta pode vir como string JSON aninhada conforme observado nos workflows n8n
  let items: unknown = body
  if (typeof body?.data === "string") {
    try {
      const parsed = JSON.parse(body.data)
      items = parsed?.data ?? parsed
    } catch {
      items = []
    }
  } else if (body?.data !== undefined) {
    items = body.data
  }

  const arr = Array.isArray(items) ? items : []
  return arr.map((item: Record<string, unknown>) => {
    const attrs = (item.attributes ?? item) as Record<string, unknown>
    return {
      id: Number(attrs.id ?? item.id ?? 0),
      document_type: String(attrs.document_type ?? ""),
      document_number: String(attrs.document_number ?? attrs.searchable_document_no ?? ""),
      date: String(attrs.date ?? ""),
      total: Number(attrs.total ?? 0),
      net_total: attrs.net_total !== undefined ? Number(attrs.net_total) : undefined,
      communication_status: attrs.communication_status as string | undefined,
      supplier_tax_registration_number: attrs.supplier_tax_registration_number as string | undefined,
      supplier_business_name: attrs.supplier_business_name as string | undefined,
      external_reference: attrs.external_reference as string | undefined,
    }
  })
}

// ---------------------------------------------------------------------------
// Document associations (e-Fatura AT status)
// app13.toconline.pt/api/document_associations?filter="date BETWEEN 'X' AND 'Y'"
// ---------------------------------------------------------------------------

export interface DocumentAssociation {
  id: number
  document_number: string | null
  date: string | null
  supplier_name: string | null
  supplier_nif: string | null
  total: number
  at_status: string | null
}

export async function fetchDocumentAssociations(
  accessToken: string,
  appBase: string,
  dateFrom: string,
  dateTo: string,
): Promise<DocumentAssociation[]> {
  const url = new URL(`${appBase.replace(/\/$/, "")}/api/document_associations`)
  url.searchParams.set("filter", `"date BETWEEN '${dateFrom}' AND '${dateTo}'"`)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  })

  if (!res.ok) {
    throw new Error(`TOConline document_associations ${res.status}: ${await res.text()}`)
  }

  const body = await res.json()
  let items: unknown[] = []
  if (Array.isArray(body)) items = body
  else if (Array.isArray(body?.data)) items = body.data

  return items.map((item: unknown) => {
    const r = item as Record<string, unknown>
    const attrs = (r.attributes ?? r) as Record<string, unknown>
    return {
      id: Number(r.id ?? attrs.id ?? 0),
      document_number: attrs.document_number ? String(attrs.document_number) : null,
      date: attrs.date ? String(attrs.date) : null,
      supplier_name: attrs.supplier_name ? String(attrs.supplier_name) : null,
      supplier_nif: attrs.supplier_tax_registration_number
        ? String(attrs.supplier_tax_registration_number)
        : null,
      total: Number(attrs.total ?? 0),
      at_status: attrs.at_status ? String(attrs.at_status) : null,
    }
  })
}

// ---------------------------------------------------------------------------
// AT communication
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

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
