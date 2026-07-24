/**
 * Criacao de NCF (nota de credito de fornecedor) no TOConline.
 * So muda o document_type de "FC" para "NCF"; o TOConline cria a NCF autonoma
 * (nao referencia o FC). Reutiliza fornecedor + tax_code do fc.ts.
 *
 * Transporte via tocRequest: serve os DOIS modos (direto e n8n pelo proxy).
 * Sequencia: dedup -> supplier lookup/create -> criar NCF -> devolver ncf_number.
 */

import { tocRequest } from "@/lib/toconline/transport"
import {
  DEFAULT_EXPENSE_CATEGORY,
  lookupOrCreateSupplier,
  taxCodeFromRate,
} from "./fc"

export interface NCFPayload {
  invoiceId: string
  /** Numero da NC do FORNECEDOR -> external_reference (paralelo ao FC). */
  creditNoteNumber: string | null
  date: string | null
  supplierNif: string | null
  supplierName: string | null
  /** Valor liquido (sempre positivo; o tipo NCF e' que o torna credito). */
  subtotal: number | null
  description: string | null
  vatRate?: number | null
  expenseCategoryCode?: string | null
}

export interface NCFResult {
  ncfNumber: string
  alreadyExisted: boolean
}

// Dedup: procurar uma NCF ja existente pelo numero da NC do fornecedor.
// RAW (sem encodeURIComponent): o tocRequest/proxy codificam a query.
function buildDedupFilter(reference: string): string {
  return (
    `"((parent_document_area != document_area) OR (parent_document_area IS NULL))` +
    ` AND document_type in ('NCF')` +
    ` AND (external_reference::TEXT ILIKE '%${reference}%'` +
    ` OR searchable_document_no::TEXT ILIKE '%${reference}%')"`
  )
}

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

async function findExistingNCF(tenantId: string, reference: string): Promise<string | null> {
  const { status, body } = await tocRequest(tenantId, {
    base: "app",
    method: "GET",
    path: "/api/commercial_purchases_documents_list_for_invoices",
    query: { filter: buildDedupFilter(reference) },
  })
  if (status >= 400) return null

  const items = extractItems(body)
  if (items.length === 0) return null

  const first = (items[0]?.attributes ?? items[0]) as Record<string, unknown>
  const docNo =
    (first.document_number as string | undefined) ??
    (first.document_no as string | undefined) ??
    (first.searchable_document_no as string | undefined)
  return docNo ? String(docNo) : null
}

async function doCreateNCF(
  tenantId: string,
  payload: NCFPayload,
  supplierId: number | null,
): Promise<string> {
  const date = payload.date ?? new Date().toISOString().slice(0, 10)
  const description = payload.description ?? payload.supplierName ?? "Nota de credito ISOFlow"

  const ncfBody: Record<string, unknown> = {
    document_type: "NCF", // <- unica diferenca vs FC
    date,
    due_date: date,
    external_reference: payload.creditNoteNumber ?? "",
    notes: description,
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
  if (supplierId !== null) ncfBody.supplier_id = supplierId

  const { status, body } = await tocRequest(tenantId, {
    base: "api",
    method: "POST",
    path: "/api/v1/commercial_purchases_documents",
    body: ncfBody,
    contentType: "application/json",
  })

  const bodyText = JSON.stringify(body)
  if (bodyText.includes("JA000")) throw new Error("JA000: NCF ja existe")
  if (status >= 400) throw new Error(`TOConline criar NCF ${status}: ${bodyText.slice(0, 300)}`)

  const doc = ((body as Record<string, unknown>)?.data ?? body) as Record<string, unknown>
  const attrs = (doc?.attributes ?? {}) as Record<string, unknown>
  const docNo =
    (doc?.document_no as string | undefined) ??
    (attrs?.document_no as string | undefined) ??
    (doc?.document_number as string | undefined) ??
    (attrs?.document_number as string | undefined)
  if (!docNo) throw new Error(`TOConline criar NCF: resposta sem document_no (${bodyText.slice(0, 200)})`)
  return String(docNo)
}

/**
 * Cria uma NCF no TOConline (modo resolvido por tocRequest). Idempotente por dedup.
 */
export async function createNCF(tenantId: string, payload: NCFPayload): Promise<NCFResult> {
  if (payload.creditNoteNumber) {
    const existing = await findExistingNCF(tenantId, payload.creditNoteNumber)
    if (existing) return { ncfNumber: existing, alreadyExisted: true }
  }

  const supplierId = await lookupOrCreateSupplier(tenantId, payload.supplierNif, payload.supplierName)

  try {
    const ncfNumber = await doCreateNCF(tenantId, payload, supplierId)
    return { ncfNumber, alreadyExisted: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("JA000") && payload.creditNoteNumber) {
      const existing = await findExistingNCF(tenantId, payload.creditNoteNumber)
      if (existing) return { ncfNumber: existing, alreadyExisted: true }
    }
    throw e
  }
}
