/**
 * Cliente Tink — Open Banking europeu (Visa).
 *
 * Fluxo OAuth para connect-accounts (one-time consent + token refresh):
 *
 *  1. Frontend chama POST /api/banking/connect → devolve URL Tink Link
 *  2. User redireciona para Tink Link, escolhe banco, autentica.
 *  3. Tink redireciona de volta para /api/banking/callback?code=... + state
 *  4. Servidor troca code por access_token + refresh_token (exchangeCode)
 *  5. Servidor lista accounts e transactions usando o access_token
 *
 * Refs: https://docs.tink.com/resources/transactions
 */

const TINK_LINK_BASE = "https://link.tink.com/1.0/transactions/connect-accounts"
const TINK_API_BASE = "https://api.tink.com"
const DEFAULT_MARKET = "PT"
const DEFAULT_LOCALE = "pt_PT"

export type TinkTokenResponse = {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  scope: string
}

export type TinkAccount = {
  id: string
  name: string
  type:
    | "CHECKING"
    | "SAVINGS"
    | "CREDIT_CARD"
    | "INVESTMENT"
    | "MORTGAGE"
    | "LOAN"
    | "PENSION"
    | "OTHER"
  identifiers?: {
    iban?: { iban?: string; bic?: string }
    financialInstitution?: { accountNumber?: string }
  }
  customerSegment?: string
  financialInstitutionId?: string
  balances?: {
    booked?: { amount?: { value?: { unscaledValue?: string; scale?: string } } }
  }
}

export type TinkTransaction = {
  id: string
  accountId: string
  amount: {
    currencyCode: string
    value: { unscaledValue: string; scale: string }
  }
  dates: {
    booked?: string
    value?: string
  }
  descriptions?: {
    display?: string
    original?: string
  }
  status: "PENDING" | "BOOKED" | "UNDEFINED"
  categories?: {
    pfm?: { id?: string; name?: string }
  }
  reference?: string
  types?: { type?: string }
  counterparties?: {
    payer?: { name?: string; identifiers?: { financialInstitution?: { accountNumber?: string } } }
    payee?: { name?: string; identifiers?: { financialInstitution?: { accountNumber?: string } } }
  }
}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.TINK_CLIENT_ID
  const clientSecret = process.env.TINK_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("TINK_CLIENT_ID / TINK_CLIENT_SECRET não configurados")
  }
  return { clientId, clientSecret }
}

/**
 * Gera URL pública do Tink Link para o utilizador autenticar com o banco.
 * O `state` deve incluir info para identificar o tenant no callback (CSRF + tenant_id).
 */
export function buildTinkLinkUrl(params: {
  redirectUri: string
  state: string
  market?: string
  locale?: string
}): string {
  const { clientId } = getCredentials()
  const url = new URL(TINK_LINK_BASE)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", params.redirectUri)
  url.searchParams.set("market", params.market ?? DEFAULT_MARKET)
  url.searchParams.set("locale", params.locale ?? DEFAULT_LOCALE)
  url.searchParams.set("state", params.state)
  return url.toString()
}

/**
 * Troca o `code` recebido no callback por access_token + refresh_token.
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<TinkTokenResponse> {
  const { clientId, clientSecret } = getCredentials()
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  })

  const response = await fetch(`${TINK_API_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Tink token exchange failed (${response.status}): ${text}`)
  }
  return (await response.json()) as TinkTokenResponse
}

/**
 * Refresh do access_token quando expira (typically 30 min).
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TinkTokenResponse> {
  const { clientId, clientSecret } = getCredentials()
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  })

  const response = await fetch(`${TINK_API_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Tink refresh failed (${response.status}): ${text}`)
  }
  return (await response.json()) as TinkTokenResponse
}

/** Lista contas associadas ao access_token. */
export async function listAccounts(
  accessToken: string,
): Promise<TinkAccount[]> {
  const response = await fetch(`${TINK_API_BASE}/data/v2/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Tink accounts failed (${response.status}): ${text}`)
  }
  const json = (await response.json()) as { accounts: TinkAccount[] }
  return json.accounts ?? []
}

/**
 * Lista transações para uma conta. Devolve até 100 por chamada.
 * Para sync inicial completo, podes querer fazer paginação com `pageToken`.
 */
export async function listTransactions(
  accessToken: string,
  options: {
    accountIdIn?: string[]
    bookedDateGte?: string // YYYY-MM-DD
    bookedDateLte?: string // YYYY-MM-DD
    pageSize?: number
    pageToken?: string
  } = {},
): Promise<{ transactions: TinkTransaction[]; nextPageToken?: string }> {
  const params = new URLSearchParams()
  if (options.accountIdIn) {
    for (const id of options.accountIdIn) {
      params.append("accountIdIn", id)
    }
  }
  if (options.bookedDateGte) params.set("bookedDateGte", options.bookedDateGte)
  if (options.bookedDateLte) params.set("bookedDateLte", options.bookedDateLte)
  params.set("pageSize", String(options.pageSize ?? 100))
  if (options.pageToken) params.set("pageToken", options.pageToken)

  const response = await fetch(
    `${TINK_API_BASE}/data/v2/transactions?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Tink transactions failed (${response.status}): ${text}`)
  }
  return (await response.json()) as {
    transactions: TinkTransaction[]
    nextPageToken?: string
  }
}

/**
 * Converte o valor decimal Tink (unscaledValue + scale) num número JS.
 * Ex: { unscaledValue: "12345", scale: "2" } → 123.45
 */
export function tinkAmountToNumber(amount: {
  unscaledValue: string
  scale: string
}): number {
  const unscaled = Number(amount.unscaledValue)
  const scale = Number(amount.scale)
  if (isNaN(unscaled) || isNaN(scale)) return 0
  return unscaled / Math.pow(10, scale)
}

/**
 * Devolve a melhor "descrição" disponível para uma transação.
 */
export function tinkTransactionDescription(t: TinkTransaction): string {
  return (
    t.descriptions?.display ??
    t.descriptions?.original ??
    t.reference ??
    ""
  )
}

export { TINK_LINK_BASE, TINK_API_BASE }
