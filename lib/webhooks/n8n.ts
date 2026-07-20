import { createHmac } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { decrypt } from "@/lib/utils/encryption"

const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hora

export interface N8nInvoicePayload {
  tenant_id: string
  invoice: {
    id: string
    supplier_name: string | null
    supplier_nif: string | null
    invoice_number: string | null
    invoice_date: string | null
    due_date: string | null
    subtotal: number | null
    vat_rate: number | null
    vat_amount: number | null
    total: number | null
    currency: string
    description: string | null
    category: string | null
    source: string
    file_path: string | null
    /** Nota do movimento bancario conciliado (mapear para notes no TOConline). */
    movement_note?: string | null
  }
  /** URL assinada do Supabase Storage para o ficheiro original. */
  file_url?: string | null
  /** Email/projeto que originou a fatura. */
  metadata: {
    sent_by?: string | null
    sender_email?: string | null
    project_id?: string | null
  }
}

export interface N8nResult {
  ok: boolean
  status?: number
  error?: string
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

/**
 * Envia a fatura processada para um webhook n8n (genérico — pode ir
 * para Toconline, Primavera ou qualquer pipeline custom).
 *
 * Header X-ISOFlow-Signature contém HMAC-SHA256 do body com o secret
 * acordado entre o cliente e o n8n.
 *
 * Resolve URL e secret nesta ordem:
 *  1. params.url + params.secret (per-tenant via tenant_integrations)
 *  2. process.env.N8N_WEBHOOK_URL + process.env.N8N_WEBHOOK_SECRET (default)
 *
 * Se nenhum estiver configurado, retorna { ok: true } silencioso —
 * é opcional.
 */
export async function sendToN8N(
  payload: N8nInvoicePayload,
  params?: { url?: string | null; secret?: string | null },
): Promise<N8nResult> {
  const url = params?.url || process.env.N8N_WEBHOOK_URL
  const secret = params?.secret || process.env.N8N_WEBHOOK_SECRET

  if (!url) {
    return { ok: true } // ERP não configurado — não é erro.
  }

  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ISOFlow-Webhook/1.0",
  }
  if (secret) {
    headers["X-ISOFlow-Signature"] = sign(body, secret)
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      return { ok: false, status: response.status, error: text.slice(0, 500) }
    }
    return { ok: true, status: response.status }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

type Client = SupabaseClient<Database>

export interface ForwardResult {
  /** "skipped" quando não há integração activa. */
  skipped?: boolean
  ok: boolean
  status?: number | null
  error?: string | null
}

/**
 * Carrega a integração ERP/n8n do tenant, gera signed URL do ficheiro
 * (se existir) e envia o payload completo para o webhook. Atualiza
 * invoices.erp_synced / erp_synced_at / sync_error consoante o resultado.
 *
 * Pode ser chamado:
 *  - Automaticamente após criar fatura (email/manual upload)
 *  - Manualmente pelo user via botão "Re-enviar para ERP"
 */
export async function forwardInvoiceToN8N(
  admin: Client,
  invoiceId: string,
  tenantId: string,
): Promise<ForwardResult> {
  // 1. Buscar integração ERP do tenant
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("config, api_key_encrypted, is_active")
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("provider", "n8n")
    .eq("is_active", true)
    .maybeSingle()

  if (!integration) {
    return { skipped: true, ok: true }
  }

  const config = (integration.config ?? {}) as { url?: string }
  if (!config.url) {
    return { skipped: true, ok: true }
  }

  let secret: string | null = null
  if (integration.api_key_encrypted) {
    try {
      secret = decrypt(integration.api_key_encrypted)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin
        .from("tenant_integrations")
        .update({
          sync_error: `Decrypt secret: ${msg}`,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("type", "erp")
        .eq("provider", "n8n")
      return { ok: false, error: msg }
    }
  }

  // 2. Buscar fatura
  const { data: invoice, error: invErr } = await admin
    .from("invoices")
    .select(
      "id, tenant_id, supplier_name, supplier_nif, invoice_number, invoice_date, due_date, subtotal, vat_rate, vat_amount, total, currency, description, category, source, file_path, sent_by, sender_email, project_id, bank_transaction_id",
    )
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (invErr || !invoice) {
    return { ok: false, error: invErr?.message ?? "Fatura não encontrada" }
  }

  // Nota do movimento bancario conciliado (se houver)
  let movementNote: string | null = null
  if (invoice.bank_transaction_id) {
    const { data: tx } = await admin
      .from("bank_transactions")
      .select("notes")
      .eq("id", invoice.bank_transaction_id)
      .eq("tenant_id", tenantId)
      .maybeSingle()
    if (tx?.notes && tx.notes.trim().length > 0) movementNote = tx.notes
  }

  // 3. Signed URL do ficheiro (se houver)
  let fileUrl: string | null = null
  if (invoice.file_path) {
    const bucket = process.env.INVOICE_FILES_BUCKET || "invoice-files"
    const { data: signed } = await admin.storage
      .from(bucket)
      .createSignedUrl(invoice.file_path, SIGNED_URL_TTL_SECONDS)
    fileUrl = signed?.signedUrl ?? null
  }

  // 4. Enviar
  const result = await sendToN8N(
    {
      tenant_id: tenantId,
      invoice: {
        id: invoice.id,
        supplier_name: invoice.supplier_name,
        supplier_nif: invoice.supplier_nif,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        subtotal: invoice.subtotal !== null ? Number(invoice.subtotal) : null,
        vat_rate: invoice.vat_rate !== null ? Number(invoice.vat_rate) : null,
        vat_amount:
          invoice.vat_amount !== null ? Number(invoice.vat_amount) : null,
        total: invoice.total !== null ? Number(invoice.total) : null,
        currency: invoice.currency ?? "EUR",
        description: invoice.description,
        category: invoice.category,
        source: invoice.source ?? "manual",
        file_path: invoice.file_path,
        movement_note: movementNote,
      },
      file_url: fileUrl,
      metadata: {
        sent_by: invoice.sent_by,
        sender_email: invoice.sender_email,
        project_id: invoice.project_id,
      },
    },
    { url: config.url, secret },
  )

  // 5. Atualizar status na fatura + integração
  const now = new Date().toISOString()
  if (result.ok) {
    await admin
      .from("invoices")
      .update({ erp_synced: true, erp_synced_at: now, updated_at: now })
      .eq("id", invoiceId)
    await admin
      .from("tenant_integrations")
      .update({ last_sync_at: now, sync_error: null, updated_at: now })
      .eq("tenant_id", tenantId)
      .eq("type", "erp")
      .eq("provider", "n8n")
  } else {
    await admin
      .from("tenant_integrations")
      .update({
        sync_error: result.error?.slice(0, 500) ?? `HTTP ${result.status}`,
        updated_at: now,
      })
      .eq("tenant_id", tenantId)
      .eq("type", "erp")
      .eq("provider", "n8n")
  }

  return {
    ok: result.ok,
    status: result.status ?? null,
    error: result.error ?? null,
  }
}
