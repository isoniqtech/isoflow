/**
 * Seam de transporte TOConline - partilhado pelos dois modos (direto e n8n).
 *
 * A ideia: TODA a logica de TOConline (leitura E escrita) vive na app. A unica
 * diferenca entre os modos e' QUEM faz o HTTP e QUEM autentica:
 *
 *  - modo `toconline_direct`: a app tem o token OAuth (getValidToken) e chama o
 *    TOConline diretamente (app{N}/api{N}.toconline.pt).
 *  - modo `n8n`: a app NAO tem o token do tenant. Envia a descricao da chamada
 *    a um proxy n8n GENERICO (N8N_TOCONLINE_PROXY_URL); o n8n resolve o token do
 *    tenant (pelo tenant_id) com o Token Manager que ja' tem, faz a chamada ao
 *    TOConline e devolve a resposta CRUA. O n8n conhece o subdominio (N); a app
 *    manda apenas `base: "app" | "api"`.
 *
 * Nenhum processamento acontece no n8n - so' query + devolve raw. O contrato:
 *   App -> n8n  { tenant_id, base, method, path, query, body }
 *   n8n -> App  { status, body }   // body = corpo tal-e-qual do TOConline
 *
 * Este ficheiro NAO altera os caminhos existentes; os consumidores migram um a
 * um para tocRequest (receita, gastos, e-fatura, categorias, FC/NCF).
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { getValidToken } from "@/lib/toconline/token"

export type TocBase = "app" | "api"
export type TocMethod = "GET" | "POST"
export type IntegrationMode = "toconline_direct" | "n8n"

export interface TocRequestOptions {
  base: TocBase
  method?: TocMethod
  path: string
  /** Query string. Codificada com encodeURIComponent (espacos -> %20).
   *  NUNCA usar URLSearchParams: codifica espacos como '+' e o TOConline
   *  devolve 400 (syntax error 42601) no filtro. */
  query?: Record<string, string>
  /** Body para POST (criar fornecedor / FC). */
  body?: unknown
  /** Content-Type do POST. Default application/json. Fornecedor usa
   *  application/vnd.api+json (JSON:API). */
  contentType?: string
  timeoutMs?: number
}

export interface TocResponse {
  status: number
  body: unknown
}

/** Le o integration_mode do tenant. Default "n8n" (comportamento historico). */
export async function getIntegrationMode(tenantId: string): Promise<IntegrationMode> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("tenants")
    .select("integration_mode")
    .eq("id", tenantId)
    .maybeSingle()
  const mode = (data as { integration_mode?: string | null } | null)?.integration_mode
  return mode === "toconline_direct" ? "toconline_direct" : "n8n"
}

function buildQueryString(query?: Record<string, string>): string {
  if (!query) return ""
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  return parts.length ? `?${parts.join("&")}` : ""
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "")
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Executa uma chamada TOConline no modo correto do tenant e devolve a resposta
 * crua ({ status, body }). Nao interpreta o body - isso e' com o chamador
 * (a mesma logica dos dois modos).
 */
export async function tocRequest(
  tenantId: string,
  opts: TocRequestOptions,
): Promise<TocResponse> {
  const mode = await getIntegrationMode(tenantId)
  return mode === "toconline_direct"
    ? tocRequestDirect(tenantId, opts)
    : tocRequestViaN8N(tenantId, opts)
}

// ── Modo direto: a app fala diretamente com o TOConline ────────────────────
async function tocRequestDirect(
  tenantId: string,
  opts: TocRequestOptions,
): Promise<TocResponse> {
  const token = await getValidToken(tenantId)
  const root = (opts.base === "api" ? token.apiBase : token.appBase).replace(/\/$/, "")
  const url = `${root}${opts.path}${buildQueryString(opts.query)}`

  const method = opts.method ?? "GET"
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.accessToken}`,
    Accept: "application/json",
  }
  const init: RequestInit = { method, headers }
  if (method === "POST" && opts.body !== undefined) {
    headers["Content-Type"] = opts.contentType ?? "application/json"
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)
  }
  if (opts.timeoutMs) init.signal = AbortSignal.timeout(opts.timeoutMs)

  const res = await fetch(url, init)
  return { status: res.status, body: await parseBody(res) }
}

/**
 * Resolve o URL do proxy n8n do tenant. Cada cliente n8n tem o SEU proprio
 * servidor n8n, por isso o URL vive PER-TENANT na integracao ERP
 * (tenant_integrations.config.proxy_url) - o mesmo padrao do config.url usado
 * pelo forwardInvoiceToN8N. A env global N8N_TOCONLINE_PROXY_URL e' so' um
 * fallback (util em dev, ou enquanto o FINMED for o unico tenant n8n).
 */
async function resolveProxyUrl(tenantId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("provider", "n8n")
    .eq("is_active", true)
    .maybeSingle()
  const cfg = ((data as { config?: unknown } | null)?.config ?? {}) as {
    proxy_url?: string
  }
  return cfg.proxy_url || process.env.N8N_TOCONLINE_PROXY_URL || null
}

// ── Modo n8n: proxy generico. O n8n resolve o token e devolve o body cru ───
async function tocRequestViaN8N(
  tenantId: string,
  opts: TocRequestOptions,
): Promise<TocResponse> {
  const proxyUrl = await resolveProxyUrl(tenantId)
  if (!proxyUrl) {
    throw new Error(
      "Proxy TOConline do n8n em falta - configura config.proxy_url na integracao " +
        "ERP do tenant (ou a env N8N_TOCONLINE_PROXY_URL como fallback)",
    )
  }
  const secret = process.env.CRON_SECRET ?? ""

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ISOFlow-Secret": secret,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      base: opts.base,
      method: opts.method ?? "GET",
      path: opts.path,
      query: opts.query ?? {},
      body: opts.body ?? null,
      // Content-Type para o POST (o proxy manda o body em Raw com este tipo).
      // Criar fornecedor precisa de application/vnd.api+json; o resto json.
      contentType: opts.contentType ?? "application/json",
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Proxy n8n TOConline HTTP ${res.status}: ${text.slice(0, 300)}`)
  }

  // Envelope { status, body }. Tolerante: se o n8n devolver o body cru sem
  // envelope, trata a resposta inteira como body com status 200.
  const envelope = (await parseBody(res)) as
    | { status?: number; body?: unknown }
    | unknown
  if (
    envelope &&
    typeof envelope === "object" &&
    "body" in (envelope as Record<string, unknown>)
  ) {
    const e = envelope as { status?: number; body?: unknown }
    return { status: typeof e.status === "number" ? e.status : 200, body: e.body }
  }
  return { status: 200, body: envelope }
}
