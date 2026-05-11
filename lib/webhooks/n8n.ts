import { createHmac } from "crypto"

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
