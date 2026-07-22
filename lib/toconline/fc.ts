/**
 * Criacao direta de FC (fatura de compra) no TOConline.
 * Replica a sequencia exacta do workflow n8n sem passar pelo n8n.
 * Usado EXCLUSIVAMENTE em integration_mode = 'toconline_direct'.
 *
 * Sequencia: dedup -> supplier lookup/create -> criar FC -> devolver fc_number.
 * Idempotente: se a FC ja existir (dedup), devolve o numero existente sem criar de novo.
 */

export interface FCPayload {
  invoiceId: string
  invoiceNumber: string | null
  invoiceDate: string | null
  supplierNif: string | null
  supplierName: string | null
  subtotal: number | null
  description: string | null
  /** Nota do movimento bancario conciliado, anexada ao campo notes do FC. */
  movementNote?: string | null
  /** Taxa de IVA da fatura (23, 13, 6, 0) para derivar o tax_code do TOConline. */
  vatRate?: number | null
}

/**
 * Mapeia a taxa de IVA da fatura para o tax_code do TOConline (regiao PT).
 * Codigos confirmados via /api/taxes: NOR=23, INT=13, RED=6, ISE=0
 * (existem tambem taxas historicas/regionais: NOR 21/20/19/17, INT 12, RED 5).
 * Default NOR quando a taxa e' desconhecida (comportamento anterior).
 */
function taxCodeFromRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "NOR"
  const r = Number(rate)
  if (!Number.isFinite(r)) return "NOR"
  if (r === 0) return "ISE"
  if (r <= 6) return "RED"
  if (r <= 13) return "INT"
  return "NOR"
}

export interface FCResult {
  fcNumber: string
  alreadyExisted: boolean
}

// ---------------------------------------------------------------------------
// Filtro de dedup - replica o filtro exacto do workflow n8n
// ---------------------------------------------------------------------------

function buildDedupFilter(invoiceNumber: string): string {
  return encodeURIComponent(
    `"((parent_document_area != document_area) OR (parent_document_area IS NULL))` +
      ` AND document_type in ('FC','DSP','NCF','NDF','NLDF','NLCF','SIF','FCA')` +
      ` AND (external_reference::TEXT ILIKE '%${invoiceNumber}%'` +
      ` OR searchable_document_no::TEXT ILIKE '%${invoiceNumber}%')` +
      ` AND (document_type IN ('FC')` +
      ` OR searchable_document_types::text ILIKE '%FC%')"`,
  )
}

function buildSupplierFilter(nif: string): string {
  return encodeURIComponent(`" s.tax_registration_number::TEXT ILIKE '%${nif}%' "`)
}

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

async function findExistingFC(
  accessToken: string,
  appBase: string,
  invoiceNumber: string,
): Promise<string | null> {
  const filter = buildDedupFilter(invoiceNumber)
  const url = `${appBase.replace(/\/$/, "")}/api/commercial_purchases_documents_list_for_invoices?filter=${filter}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  })

  if (!res.ok) return null

  const body = await res.json()
  let items: unknown = body
  if (typeof body?.data === "string") {
    try {
      const parsed = JSON.parse(body.data)
      items = parsed?.data ?? parsed
    } catch {
      return null
    }
  } else if (body?.data !== undefined) {
    items = body.data
  }

  if (!Array.isArray(items) || items.length === 0) return null

  const first = (items[0]?.attributes ?? items[0]) as Record<string, unknown>
  const docNo =
    (first.document_number as string | undefined) ??
    (first.searchable_document_no as string | undefined)

  return docNo ?? null
}

// ---------------------------------------------------------------------------
// Fornecedor
// ---------------------------------------------------------------------------

async function findSupplier(
  accessToken: string,
  appBase: string,
  nif: string,
): Promise<number | null> {
  const filter = buildSupplierFilter(nif)
  const url = `${appBase.replace(/\/$/, "")}/api/suppliers_moac?filter=${filter}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  })

  if (!res.ok) return null

  const body = await res.json()
  const items = Array.isArray(body) ? body : (body.data ?? [])
  if (!Array.isArray(items) || items.length === 0) return null

  const first = items[0]?.attributes ?? items[0]
  const id = first?.id ?? items[0]?.id
  return id ? Number(id) : null
}

async function createSupplier(
  accessToken: string,
  apiBase: string,
  nif: string,
  name: string,
): Promise<number> {
  const url = `${apiBase.replace(/\/$/, "")}/api/v1/suppliers`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      tax_registration_number: nif,
      business_name: name,
      country: "PT",
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Erro ao criar fornecedor no TOConline ${res.status}: ${text.slice(0, 300)}`)
  }

  const body = await res.json()
  const data = body.data ?? body
  const id = data?.id ?? data?.attributes?.id
  if (!id) throw new Error("TOConline: criar fornecedor nao devolveu ID")
  return Number(id)
}

async function lookupOrCreateSupplier(
  accessToken: string,
  appBase: string,
  apiBase: string,
  nif: string | null,
  name: string | null,
): Promise<number | null> {
  if (!nif) return null

  const existing = await findSupplier(accessToken, appBase, nif)
  if (existing !== null) return existing

  if (!name) return null
  return createSupplier(accessToken, apiBase, nif, name)
}

// ---------------------------------------------------------------------------
// Criar FC
// ---------------------------------------------------------------------------

async function doCreateFC(
  accessToken: string,
  apiBase: string,
  payload: FCPayload,
  supplierId: number | null,
): Promise<string> {
  const url = `${apiBase.replace(/\/$/, "")}/api/v1/commercial_purchases_documents`
  const invoiceDate = payload.invoiceDate ?? new Date().toISOString().slice(0, 10)
  const description = payload.description ?? payload.supplierName ?? "Fatura importada ISOFlow"

  // Nota do movimento bancario (se conciliado) anexada ao campo notes do FC,
  // para ficar visivel ao contabilista no TOConline.
  const movementNote = payload.movementNote?.trim()
  const notes = movementNote
    ? `${description}\nNota mov. banco: ${movementNote}`
    : description

  const body: Record<string, unknown> = {
    document_type: "FC",
    date: invoiceDate,
    due_date: invoiceDate,
    external_reference: payload.invoiceNumber ?? "",
    notes,
    vat_included_prices: false,
    retention_total: 0,
    lines: [
      {
        item_type: "Purchases::ExpenseCategory",
        item_code: "6221",
        description,
        quantity: 1,
        unit_price: payload.subtotal ?? 0,
        tax_code: taxCodeFromRate(payload.vatRate),
      },
    ],
  }

  if (supplierId !== null) {
    body.supplier_id = supplierId
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    // JA000 = documento ja existe no TOConline (race condition no dedup)
    if (res.status === 400 && text.includes("JA000")) {
      throw new Error("JA000: FC ja existe")
    }
    throw new Error(`TOConline criar FC ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  const doc = data.data ?? data
  const docNo =
    doc?.document_no ??
    doc?.attributes?.document_no ??
    doc?.document_number ??
    doc?.attributes?.document_number

  if (!docNo) {
    throw new Error("TOConline criar FC: resposta sem document_no")
  }
  return String(docNo)
}

// ---------------------------------------------------------------------------
// Ponto de entrada publico
// ---------------------------------------------------------------------------

/**
 * Cria uma FC no TOConline em modo direto.
 * Idempotente: se a FC ja existir, devolve o numero sem criar de novo.
 *
 * @param accessToken token de acesso valido (usar getValidToken() antes)
 * @param appBase URL base da app (ex: https://app13.toconline.pt) - endpoints custom
 * @param apiBase URL base da API REST (ex: https://api13.toconline.pt) - endpoints /api/v1/
 * @param payload dados da fatura ISOFlow
 */
export async function createDirectFC(
  accessToken: string,
  appBase: string,
  apiBase: string,
  payload: FCPayload,
): Promise<FCResult> {
  // 1. Dedup - verificar se FC ja existe (endpoint custom em appBase)
  if (payload.invoiceNumber) {
    const existing = await findExistingFC(accessToken, appBase, payload.invoiceNumber)
    if (existing) {
      return { fcNumber: existing, alreadyExisted: true }
    }
  }

  // 2. Fornecedor - procurar (appBase) ou criar (apiBase)
  const supplierId = await lookupOrCreateSupplier(
    accessToken,
    appBase,
    apiBase,
    payload.supplierNif,
    payload.supplierName,
  )

  // 3. Criar FC (endpoint REST em apiBase)
  try {
    const fcNumber = await doCreateFC(accessToken, apiBase, payload, supplierId)
    return { fcNumber, alreadyExisted: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Race condition: dedup passou mas FC foi criada entretanto (JA000)
    if (msg.includes("JA000") && payload.invoiceNumber) {
      const existing = await findExistingFC(accessToken, appBase, payload.invoiceNumber)
      if (existing) return { fcNumber: existing, alreadyExisted: true }
    }
    throw e
  }
}
