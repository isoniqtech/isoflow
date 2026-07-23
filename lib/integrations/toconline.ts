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
// Receita liquida de notas de credito (Fase 2)
// receita = soma(FR + FT + FS) - soma(NC). NLD/NLC (lancamentos) e SHI (guia de
// remessa) sao ignorados. Codigos SAF-T PT confirmados contra o TOConline real.
// Os valores vem positivos no v1 (o sinal esta' no document_type).
// ---------------------------------------------------------------------------

const SALES_REVENUE_TYPES = new Set(["FR", "FT", "FS"])

export function salesRevenueSign(documentType: string | null | undefined): number {
  const t = (documentType ?? "").toUpperCase()
  if (t === "NC") return -1
  if (SALES_REVENUE_TYPES.has(t)) return 1
  return 0
}

export function sumSalesRevenue(
  docs: Array<{ document_type?: string | null; net_total?: number | null; subtotal?: number | null }>,
): number {
  return docs.reduce(
    (sum, d) => sum + salesRevenueSign(d.document_type) * Number(d.net_total ?? d.subtotal ?? 0),
    0,
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
  // Construir o URL a' mao com encodeURIComponent (espacos -> %20). NAO usar
  // URLSearchParams: codifica espacos como '+' e o TOConline nao os interpreta
  // como espaco no filtro, devolvendo 400 (syntax error 42601).
  let url = `${appBase.replace(/\/$/, "")}/api/commercial_purchases_documents_list_for_invoices`
  if (filter) {
    url += `?filter=${encodeURIComponent(filter)}`
  }

  const res = await fetch(url, {
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
  // Construir o URL a' mao com encodeURIComponent (espacos -> %20), tal como o
  // workflow n8n que funciona. URLSearchParams codifica espacos como '+' e o
  // TOConline devolve 400 (syntax error 42601) por nao os tratar como espaco.
  const filter = `"date BETWEEN '${dateFrom}' AND '${dateTo}'"`
  const url = `${appBase.replace(/\/$/, "")}/api/document_associations?filter=${encodeURIComponent(filter)}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  })

  if (!res.ok) {
    throw new Error(`TOConline document_associations ${res.status}: ${await res.text()}`)
  }

  const body = await res.json()

  // A resposta do TOConline pode vir com `data` como string JSON aninhada
  // (comportamento observado no workflow n8n da e-Fatura) ou como objeto/array
  // direto. Resolver os dois casos, tal como o n8n faz.
  let container: unknown = body
  const bodyData = (body as Record<string, unknown>)?.data
  if (typeof bodyData === "string") {
    try {
      container = JSON.parse(bodyData)
    } catch {
      container = { data: [] }
    }
  } else if (bodyData !== undefined) {
    container = bodyData
  }

  let items: unknown[] = []
  if (Array.isArray(container)) items = container
  else if (Array.isArray((container as Record<string, unknown>)?.data)) {
    items = (container as Record<string, unknown>).data as unknown[]
  }

  return items.map((item: unknown) => {
    const r = item as Record<string, unknown>
    const attrs = (r.attributes ?? r) as Record<string, unknown>
    // Nomes de campos conforme o document_associations do TOConline (via n8n):
    // document_identifier, business_name, tax_registration_number, gross_total, status.
    // Fallback para os nomes antigos por robustez.
    const identifier = attrs.document_identifier ?? attrs.document_number
    const business = attrs.business_name ?? attrs.supplier_name
    const nif = attrs.tax_registration_number ?? attrs.supplier_tax_registration_number
    const grossTotal = attrs.gross_total ?? attrs.total
    return {
      id: Number(r.id ?? attrs.id ?? 0),
      document_number: identifier ? String(identifier) : null,
      date: attrs.date ? String(attrs.date) : null,
      supplier_name: business ? String(business) : null,
      supplier_nif: nif ? String(nif) : null,
      total: Number(grossTotal ?? 0),
      at_status: mapAtStatus(attrs.status ?? attrs.at_status),
    }
  })
}

// Mapeia o estado de reconciliacao do TOConline para os rotulos usados na app
// (identico ao workflow n8n). "Associada" e' o estado positivo reconhecido
// pela reconciliacao em /api/efatura/refresh (AT_POSITIVE).
function mapAtStatus(status: unknown): string | null {
  if (status == null || status === "") return null
  const s = String(status)
  if (s === "pending") return "Pendente"
  if (s === "void") return "Não considerado na atividade"
  if (s === "associated") return "Associada"
  return s
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
