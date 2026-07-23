/**
 * Criacao direta de NCF (nota de credito de fornecedor) no TOConline.
 * Caminho ISOLADO e novo - nao toca no fc.ts (FC). So muda o document_type de
 * "FC" para "NCF"; o TOConline cria a NCF autonoma (nao referencia o FC - ver
 * o handoff das notas de credito). Reutiliza fornecedor + tax_code do fc.ts.
 *
 * Usado EXCLUSIVAMENTE em integration_mode = 'toconline_direct'.
 * Sequencia: dedup -> supplier lookup/create -> criar NCF -> devolver ncf_number.
 */

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
function buildDedupFilter(reference: string): string {
  return encodeURIComponent(
    `"((parent_document_area != document_area) OR (parent_document_area IS NULL))` +
      ` AND document_type in ('NCF')` +
      ` AND (external_reference::TEXT ILIKE '%${reference}%'` +
      ` OR searchable_document_no::TEXT ILIKE '%${reference}%')"`,
  )
}

async function findExistingNCF(
  accessToken: string,
  appBase: string,
  reference: string,
): Promise<string | null> {
  const filter = buildDedupFilter(reference)
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
    (first.document_no as string | undefined) ??
    (first.searchable_document_no as string | undefined)
  return docNo ?? null
}

async function doCreateNCF(
  accessToken: string,
  apiBase: string,
  payload: NCFPayload,
  supplierId: number | null,
): Promise<string> {
  const url = `${apiBase.replace(/\/$/, "")}/api/v1/commercial_purchases_documents`
  const date = payload.date ?? new Date().toISOString().slice(0, 10)
  const description =
    payload.description ?? payload.supplierName ?? "Nota de credito ISOFlow"

  const body: Record<string, unknown> = {
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
  if (supplierId !== null) body.supplier_id = supplierId

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
    if (res.status === 400 && text.includes("JA000")) {
      throw new Error("JA000: NCF ja existe")
    }
    throw new Error(`TOConline criar NCF ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  const doc = data.data ?? data
  const docNo =
    doc?.document_no ??
    doc?.attributes?.document_no ??
    doc?.document_number ??
    doc?.attributes?.document_number
  if (!docNo) throw new Error("TOConline criar NCF: resposta sem document_no")
  return String(docNo)
}

/**
 * Cria uma NCF no TOConline em modo direto. Idempotente por dedup.
 */
export async function createDirectNCF(
  accessToken: string,
  appBase: string,
  apiBase: string,
  payload: NCFPayload,
): Promise<NCFResult> {
  if (payload.creditNoteNumber) {
    const existing = await findExistingNCF(accessToken, appBase, payload.creditNoteNumber)
    if (existing) return { ncfNumber: existing, alreadyExisted: true }
  }

  const supplierId = await lookupOrCreateSupplier(
    accessToken,
    appBase,
    apiBase,
    payload.supplierNif,
    payload.supplierName,
  )

  try {
    const ncfNumber = await doCreateNCF(accessToken, apiBase, payload, supplierId)
    return { ncfNumber, alreadyExisted: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("JA000") && payload.creditNoteNumber) {
      const existing = await findExistingNCF(accessToken, appBase, payload.creditNoteNumber)
      if (existing) return { ncfNumber: existing, alreadyExisted: true }
    }
    throw e
  }
}
