/**
 * Envio de uma nota de credito (NCF) ao ERP - caminho ISOLADO, novo.
 * Nao passa pelo create-fc nem pelo forwardInvoiceToN8N (FC). Trata os dois modos:
 *  - toconline_direct: cria a NCF diretamente (lib/toconline/ncf.ts)
 *  - n8n: chama um webhook PROPRIO da NCF (N8N_NCF_WEBHOOK_URL), distinto do FC
 *
 * Decisao de produto (Opcao A): a NCF e' independente do FC. Nao espera pelo FC
 * original; a ligacao FC<->NCF vive so na app. Ver o handoff das notas de credito.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { getValidToken } from "@/lib/toconline/token"
import { createDirectNCF } from "@/lib/toconline/ncf"
import { DEFAULT_EXPENSE_CATEGORY } from "@/lib/toconline/fc"
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

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("integration_mode")
    .eq("id", tenantId)
    .maybeSingle()
  const integrationMode =
    (tenantRow as { integration_mode?: string } | null)?.integration_mode ?? "n8n"

  if (integrationMode === "toconline_direct") {
    return sendDirect(admin, tenantId, invoice)
  }
  return sendViaN8N(admin, tenantId, invoice)
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

async function sendDirect(
  admin: SupabaseClient,
  tenantId: string,
  invoice: InvoiceRow,
): Promise<SendNCFResult> {
  let token: Awaited<ReturnType<typeof getValidToken>>
  try {
    token = await getValidToken(tenantId)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  try {
    const result = await createDirectNCF(token.accessToken, token.appBase, token.apiBase, {
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

async function sendViaN8N(
  admin: SupabaseClient,
  tenantId: string,
  invoice: InvoiceRow,
): Promise<SendNCFResult> {
  // URL do webhook PROPRIO da NCF (distinto do FC): config do tenant ou env.
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("provider", "n8n")
    .eq("is_active", true)
    .maybeSingle()

  const ncfUrl =
    (integration?.config as { ncf_url?: string } | null)?.ncf_url ||
    process.env.N8N_NCF_WEBHOOK_URL
  if (!ncfUrl) {
    return { ok: false, error: "Webhook n8n da NCF nao configurado (N8N_NCF_WEBHOOK_URL)" }
  }

  const cronSecret = process.env.CRON_SECRET ?? ""
  try {
    const res = await fetch(ncfUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ISOFlow-Secret": cronSecret },
      body: JSON.stringify({
        tenant_id: tenantId,
        callback_secret: cronSecret,
        credit_note: {
          id: invoice.id,
          supplier_name: invoice.supplier_name,
          supplier_nif: invoice.supplier_nif,
          credit_note_number: invoice.invoice_number,
          date: invoice.invoice_date,
          subtotal: invoice.subtotal !== null ? Number(invoice.subtotal) : null,
          vat_rate: invoice.vat_rate !== null ? Number(invoice.vat_rate) : null,
          vat_amount: invoice.vat_amount !== null ? Number(invoice.vat_amount) : null,
          total: invoice.total !== null ? Number(invoice.total) : null,
          description: invoice.description,
          currency: invoice.currency ?? "EUR",
          item_code: invoice.expense_category_code ?? DEFAULT_EXPENSE_CATEGORY,
        },
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, error: `n8n NCF ${res.status}: ${text.slice(0, 300)}` }
    }
    // O workflow n8n cria a NCF e faz callback para gravar o numero (como no FC).
    return { ok: true, queued: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
