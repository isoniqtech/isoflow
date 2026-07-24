/**
 * Criacao de FC (fatura de compra) no TOConline.
 *
 * Sequencia: dedup -> supplier lookup/create -> criar FC -> devolver fc_number.
 * Idempotente: se a FC ja existir (dedup), devolve o numero existente.
 *
 * Transporte via tocRequest: serve os DOIS modos (direto por OAuth, n8n pelo
 * proxy). Substitui o workflow n8n de criacao de FC (que estava incompleto -
 * sem criar fornecedor - e com item_code/tax_code hardcoded).
 */

import { tocRequest } from "@/lib/toconline/transport"

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
  /**
   * Categoria de gasto do TOConline (accounting_number, ex: "6221").
   * Configurada por tenant; se ausente usa DEFAULT_EXPENSE_CATEGORY.
   */
  expenseCategoryCode?: string | null
}

/**
 * Categoria de gasto usada quando o tenant nao tem nenhuma configurada.
 * "6221" = Trabalhos especializados / Servicos (conta SNC comum).
 */
export const DEFAULT_EXPENSE_CATEGORY = "6221"

/**
 * Mapeia a taxa de IVA da fatura para o tax_code do TOConline (regiao PT).
 * Codigos confirmados via /api/taxes: NOR=23, INT=13, RED=6, ISE=0.
 */
export function taxCodeFromRate(rate: number | null | undefined): string {
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
// Filtros de dedup / fornecedor. RAW (sem encodeURIComponent): o tocRequest
// (direto) e o proxy n8n codificam a query uma vez com encodeURIComponent.
// ---------------------------------------------------------------------------

function buildDedupFilter(invoiceNumber: string): string {
  return (
    `"((parent_document_area != document_area) OR (parent_document_area IS NULL))` +
    ` AND document_type in ('FC','DSP','NCF','NDF','NLDF','NLCF','SIF','FCA')` +
    ` AND (external_reference::TEXT ILIKE '%${invoiceNumber}%'` +
    ` OR searchable_document_no::TEXT ILIKE '%${invoiceNumber}%')` +
    ` AND (document_type IN ('FC')` +
    ` OR searchable_document_types::text ILIKE '%FC%')"`
  )
}

function buildSupplierFilter(nif: string): string {
  return `" s.tax_registration_number::TEXT ILIKE '%${nif}%' "`
}

/**
 * Extrai um array de itens do body do TOConline, tolerante aos varios formatos:
 * array direto, { data: [...] }, ou { data: "<json string aninhada>" }.
 */
function extractItems(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>
  const o = (body ?? {}) as Record<string, unknown>
  const d = o.data
  if (Array.isArray(d)) return d as Array<Record<string, unknown>>
  if (typeof d === "string") {
    try {
      const p = JSON.parse(d) as unknown
      if (Array.isArray(p)) return p as Array<Record<string, unknown>>
      const pd = (p ?? {}) as Record<string, unknown>
      return Array.isArray(pd.data) ? (pd.data as Array<Record<string, unknown>>) : []
    } catch {
      return []
    }
  }
  return []
}

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

async function findExistingFC(tenantId: string, invoiceNumber: string): Promise<string | null> {
  const { status, body } = await tocRequest(tenantId, {
    base: "app",
    method: "GET",
    path: "/api/commercial_purchases_documents_list_for_invoices",
    query: { filter: buildDedupFilter(invoiceNumber) },
  })
  if (status >= 400) return null

  const items = extractItems(body)
  if (items.length === 0) return null

  const first = (items[0]?.attributes ?? items[0]) as Record<string, unknown>
  const docNo =
    (first.document_number as string | undefined) ??
    (first.searchable_document_no as string | undefined)
  return docNo ? String(docNo) : null
}

// ---------------------------------------------------------------------------
// Fornecedor
// ---------------------------------------------------------------------------

async function findSupplier(tenantId: string, nif: string): Promise<number | null> {
  const { status, body } = await tocRequest(tenantId, {
    base: "app",
    method: "GET",
    path: "/api/suppliers_moac",
    query: { filter: buildSupplierFilter(nif) },
  })
  if (status >= 400) return null

  const items = extractItems(body)
  if (items.length === 0) return null

  const first = (items[0]?.attributes ?? items[0]) as Record<string, unknown>
  const id = (first?.id as string | number | undefined) ?? (items[0]?.id as string | number | undefined)
  return id ? Number(id) : null
}

/**
 * Cria um fornecedor no TOConline.
 *  - caminho /api/suppliers (NAO /api/v1/suppliers - bloqueado pelo gatekeeper)
 *  - Content-Type application/vnd.api+json
 *  - body JSON:API { data: { type: "suppliers", attributes: {...} } }
 *  - tax_registration_number numerico
 * Tenta apiBase e, se 404, tenta appBase.
 */
async function createSupplier(tenantId: string, nif: string, name: string): Promise<number> {
  const payload = {
    data: {
      type: "suppliers",
      attributes: { tax_registration_number: Number(nif), business_name: name },
    },
  }

  let lastErr = "sem resposta"
  for (const base of ["api", "app"] as const) {
    const { status, body } = await tocRequest(tenantId, {
      base,
      method: "POST",
      path: "/api/suppliers",
      body: payload,
      contentType: "application/vnd.api+json",
    })

    if (status < 400) {
      const data = ((body as Record<string, unknown>)?.data ?? body) as Record<string, unknown>
      const id = (data?.id as string | number | undefined) ??
        ((data?.attributes as Record<string, unknown> | undefined)?.id as string | number | undefined)
      if (!id) throw new Error(`TOConline: criar fornecedor nao devolveu ID (${JSON.stringify(body).slice(0, 200)})`)
      return Number(id)
    }

    lastErr = `${status}: ${JSON.stringify(body).slice(0, 300)}`
    if (status !== 404) break
  }

  throw new Error(`Erro ao criar fornecedor no TOConline ${lastErr}`)
}

export async function lookupOrCreateSupplier(
  tenantId: string,
  nif: string | null,
  name: string | null,
): Promise<number | null> {
  if (!nif) return null

  const existing = await findSupplier(tenantId, nif)
  if (existing !== null) return existing

  if (!name) return null
  return createSupplier(tenantId, nif, name)
}

// ---------------------------------------------------------------------------
// Criar FC
// ---------------------------------------------------------------------------

async function doCreateFC(
  tenantId: string,
  payload: FCPayload,
  supplierId: number | null,
): Promise<string> {
  const invoiceDate = payload.invoiceDate ?? new Date().toISOString().slice(0, 10)
  const description = payload.description ?? payload.supplierName ?? "Fatura importada ISOFlow"

  const movementNote = payload.movementNote?.trim()
  const notes = movementNote ? `${description}\nNota mov. banco: ${movementNote}` : description

  const fcBody: Record<string, unknown> = {
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
        item_code: payload.expenseCategoryCode?.trim() || DEFAULT_EXPENSE_CATEGORY,
        description,
        quantity: 1,
        unit_price: payload.subtotal ?? 0,
        tax_code: taxCodeFromRate(payload.vatRate),
      },
    ],
  }
  if (supplierId !== null) fcBody.supplier_id = supplierId

  const { status, body } = await tocRequest(tenantId, {
    base: "api",
    method: "POST",
    path: "/api/v1/commercial_purchases_documents",
    body: fcBody,
    contentType: "application/json",
  })

  const bodyText = JSON.stringify(body)

  // JA000 = documento ja existe (race no dedup). Detetado por status OU corpo,
  // porque conforme a config do proxy o status pode nao vir fiavel.
  if (bodyText.includes("JA000")) throw new Error("JA000: FC ja existe")
  if (status >= 400) throw new Error(`TOConline criar FC ${status}: ${bodyText.slice(0, 300)}`)

  const doc = ((body as Record<string, unknown>)?.data ?? body) as Record<string, unknown>
  const attrs = (doc?.attributes ?? {}) as Record<string, unknown>
  const docNo =
    (doc?.document_no as string | undefined) ??
    (attrs?.document_no as string | undefined) ??
    (doc?.document_number as string | undefined) ??
    (attrs?.document_number as string | undefined)

  if (!docNo) throw new Error(`TOConline criar FC: resposta sem document_no (${bodyText.slice(0, 200)})`)
  return String(docNo)
}

// ---------------------------------------------------------------------------
// Ponto de entrada publico
// ---------------------------------------------------------------------------

/**
 * Cria uma FC no TOConline (modo resolvido por tocRequest a partir do tenant).
 * Idempotente: se a FC ja existir, devolve o numero sem criar de novo.
 */
export async function createFC(tenantId: string, payload: FCPayload): Promise<FCResult> {
  // 1. Dedup
  if (payload.invoiceNumber) {
    const existing = await findExistingFC(tenantId, payload.invoiceNumber)
    if (existing) return { fcNumber: existing, alreadyExisted: true }
  }

  // 2. Fornecedor (procurar ou criar)
  const supplierId = await lookupOrCreateSupplier(tenantId, payload.supplierNif, payload.supplierName)

  // 3. Criar FC
  try {
    const fcNumber = await doCreateFC(tenantId, payload, supplierId)
    return { fcNumber, alreadyExisted: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Race: dedup passou mas a FC foi criada entretanto (JA000)
    if (msg.includes("JA000") && payload.invoiceNumber) {
      const existing = await findExistingFC(tenantId, payload.invoiceNumber)
      if (existing) return { fcNumber: existing, alreadyExisted: true }
    }
    throw e
  }
}
