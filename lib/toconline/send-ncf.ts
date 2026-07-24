/**
 * Envio de uma nota de credito (NCF) ao ERP - caminho ISOLADO.
 * Cria a NCF via app nos DOIS modos (direto por OAuth, n8n pelo proxy), pelo
 * ncf.ts/tocRequest. Ja NAO ha' forward a um webhook n8n proprio.
 *
 * Decisao de produto (Opcao A): a NCF e' independente do FC. A ligacao FC<->NCF
 * vive so' na app.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { createNCF } from "@/lib/toconline/ncf"
import { PRE_ERP_STATUSES } from "@/lib/utils/invoice-status"

export interface SendNCFResult {
  ok: boolean
  skipped?: boolean
  alreadyExisted?: boolean
  queued?: boolean
  ncfNumber?: string | null
  error?: string
}

type InvoiceRow = {
  id: string
  document_kind: string | null
  supplier_name: string | null
  supplier_nif: string | null
  invoice_number: string | null
  invoice_date: string | null
  subtotal: number | null
  vat_rate: number | null
  vat_amount: number | null
  total: number | null
  description: string | null
  currency: string | null
  toconline_fc_id: string | null
  expense_category_code: string | null
  status: string | null
}

/**
 * Envia UMA nota de credito ao ERP. Idempotente: se ja tem toconline_fc_id, salta.
 * So atua sobre document_kind='credit_note'.
 */
export async function sendCreditNoteToERP(
  tenantId: string,
  invoiceId: string,
): Promise<SendNCFResult> {
  const admin = createAdminClient() as unknown as SupabaseClient

  const { data: inv } = await admin
    .from("invoices")
    .select(
      "id, document_kind, supplier_name, supplier_nif, invoice_number, invoice_date, subtotal, vat_rate, vat_amount, total, description, currency, toconline_fc_id, expense_category_code, status",
    )
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const invoice = inv as InvoiceRow | null
  if (!invoice) return { ok: false, error: "Nota de credito nao encontrada" }
  if (invoice.document_kind !== "credit_note") {
    return { ok: false, error: "O documento nao e' uma nota de credito" }
  }
  if (invoice.toconline_fc_id) {
    return { ok: true, skipped: true, ncfNumber: invoice.toconline_fc_id }
  }

  // Cria a NCF via app (os dois modos, resolvido pelo tocRequest). Sem branching.
  try {
    const result = await createNCF(tenantId, {
      invoiceId: invoice.id,
      creditNoteNumber: invoice.invoice_number,
      date: invoice.invoice_date,
      supplierNif: invoice.supplier_nif,
      supplierName: invoice.supplier_name,
      subtotal: invoice.subtotal !== null ? Number(invoice.subtotal) : null,
      description: invoice.description,
      vatRate: invoice.vat_rate !== null ? Number(invoice.vat_rate) : null,
      expenseCategoryCode: invoice.expense_category_code,
    })
    await markSent(admin, tenantId, invoice.id, result.ncfNumber)
    return { ok: true, alreadyExisted: result.alreadyExisted, ncfNumber: result.ncfNumber }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Auto-envio de uma NCF ao ERP se o tenant tiver auto_erp_send ativo.
 * Fire-and-forget nos pontos de criacao (paralelo ao auto-send do FC).
 */
export async function autoSendCreditNoteIfEnabled(
  tenantId: string,
  invoiceId: string,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: tenant } = await admin
      .from("tenants")
      .select("auto_erp_send")
      .eq("id", tenantId)
      .maybeSingle()
    if (!tenant?.auto_erp_send) return
    await sendCreditNoteToERP(tenantId, invoiceId)
  } catch (e) {
    console.warn("auto NCF send failed:", e)
  }
}

async function markSent(
  admin: SupabaseClient,
  tenantId: string,
  invoiceId: string,
  ncfNumber: string,
) {
  const now = new Date().toISOString()
  await admin
    .from("invoices")
    .update({ toconline_fc_id: ncfNumber, erp_synced: true, erp_synced_at: now, updated_at: now })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
  await admin
    .from("invoices")
    .update({ status: "enviada_erp", updated_at: now })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .in("status", PRE_ERP_STATUSES as unknown as string[])
}
