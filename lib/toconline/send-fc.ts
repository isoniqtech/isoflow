/**
 * Envio de UMA fatura ao ERP (FC ou NCF), via app.
 * Ponto unico usado pelos botoes manuais (send-erp, resend-erp), pelo auto-envio
 * (criacao manual/email, gated por auto_erp_send) e onde for preciso enviar uma
 * fatura ao ERP. Resolve o modo pelo tocRequest (direto por OAuth / n8n pelo proxy).
 *
 * Notas de credito seguem o caminho NCF (send-ncf.ts); as restantes o caminho FC.
 * Idempotente: se ja tem toconline_fc_id, salta.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { createFC } from "@/lib/toconline/fc"
import { sendCreditNoteToERP } from "@/lib/toconline/send-ncf"
import { PRE_ERP_STATUSES } from "@/lib/utils/invoice-status"

export interface SendFCResult {
  ok: boolean
  skipped?: boolean
  alreadyExisted?: boolean
  fcNumber?: string | null
  error?: string
}

type Row = {
  id: string
  document_kind: string | null
  supplier_name: string | null
  supplier_nif: string | null
  invoice_number: string | null
  invoice_date: string | null
  subtotal: number | null
  vat_rate: number | null
  description: string | null
  toconline_fc_id: string | null
  expense_category_code: string | null
  bank_transaction_id: string | null
}

export async function sendInvoiceToERP(
  tenantId: string,
  invoiceId: string,
): Promise<SendFCResult> {
  const admin = createAdminClient() as unknown as SupabaseClient

  const { data } = await admin
    .from("invoices")
    .select(
      "id, document_kind, supplier_name, supplier_nif, invoice_number, invoice_date, subtotal, vat_rate, description, toconline_fc_id, expense_category_code, bank_transaction_id",
    )
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const inv = data as Row | null
  if (!inv) return { ok: false, error: "Fatura nao encontrada" }

  // Notas de credito: caminho NCF dedicado.
  if (inv.document_kind === "credit_note") {
    const r = await sendCreditNoteToERP(tenantId, invoiceId)
    return {
      ok: r.ok,
      skipped: r.skipped,
      alreadyExisted: r.alreadyExisted,
      fcNumber: r.ncfNumber,
      error: r.error,
    }
  }

  if (inv.toconline_fc_id) return { ok: true, skipped: true, fcNumber: inv.toconline_fc_id }

  // Nota do movimento bancario conciliado (se houver)
  let movementNote: string | null = null
  if (inv.bank_transaction_id) {
    const { data: tx } = await admin
      .from("bank_transactions")
      .select("notes")
      .eq("id", inv.bank_transaction_id)
      .eq("tenant_id", tenantId)
      .maybeSingle()
    if (tx?.notes && tx.notes.trim().length > 0) movementNote = tx.notes
  }

  try {
    const result = await createFC(tenantId, {
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      supplierNif: inv.supplier_nif,
      supplierName: inv.supplier_name,
      subtotal: inv.subtotal !== null ? Number(inv.subtotal) : null,
      description: inv.description,
      movementNote,
      vatRate: inv.vat_rate !== null ? Number(inv.vat_rate) : null,
      expenseCategoryCode: inv.expense_category_code ?? null,
    })

    const now = new Date().toISOString()
    await admin
      .from("invoices")
      .update({ toconline_fc_id: result.fcNumber, erp_synced: true, erp_synced_at: now, updated_at: now })
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
    await admin
      .from("invoices")
      .update({ status: "enviada_erp", updated_at: now })
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
      .in("status", PRE_ERP_STATUSES as unknown as string[])

    return { ok: true, alreadyExisted: result.alreadyExisted, fcNumber: result.fcNumber }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
