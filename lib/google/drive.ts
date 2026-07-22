/**
 * Integracao Google Drive por tenant.
 *
 * Scope: **drive.file apenas**. Isto limita o acesso da app aos ficheiros e
 * pastas que ela propria cria - nunca ve o resto do Drive do utilizador. E' o
 * scope minimo para o caso de uso (guardar documentos de projeto) e evita a
 * verificacao de scopes restritos do Google.
 *
 * Os tokens sao cifrados em repouso (AES-256) e NUNCA chegam ao cliente:
 * todas as chamadas ao Drive sao server-side. O download/preview e' feito por
 * proxy, para o utilizador nao precisar de conta Google.
 *
 * Padrao de renovacao copiado do que ja' funciona no TOConline
 * (lib/toconline/token.ts): expiracao absoluta guardada em coluna, renovacao
 * proativa com folga, e um helper central que devolve sempre um token valido.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptOptional, encrypt } from "@/lib/utils/encryption"

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
export const ROOT_FOLDER_NAME = "Projetos Flow"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const DRIVE_API = "https://www.googleapis.com/drive/v3"
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"

/** Renovar quando faltar menos de 5 min (o token do Google vive ~1h). */
const REFRESH_BUFFER_MS = 5 * 60_000

export function getGoogleClientId(): string {
  return process.env.GOOGLE_DRIVE_CLIENT_ID ?? ""
}
export function getGoogleClientSecret(): string {
  return process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? ""
}
export function getDriveRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/integracoes/google-drive/oauth/callback`
}

type IntegrationRow = {
  id: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  token_expiry: string | null
  root_folder_id: string | null
}

function admin(): SupabaseClient {
  // Cast: tabela da migration 041, ainda nao esta' em types/supabase.ts
  return createAdminClient() as unknown as SupabaseClient
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

/**
 * Troca o `code` do OAuth por tokens. Usado apenas no callback.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getDriveRedirectUri(),
      grant_type: "authorization_code",
    }).toString(),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`Google token exchange ${res.status}: ${t.slice(0, 300)}`)
  }
  return res.json()
}

/**
 * Devolve um access token valido para o tenant, renovando se necessario.
 * Lanca se o tenant nao tiver o Drive ligado ou se a renovacao falhar
 * (o caller mostra a mensagem ao utilizador).
 */
export async function getValidDriveToken(tenantId: string): Promise<string> {
  const sb = admin()
  const { data } = await sb
    .from("google_drive_integrations")
    .select("id, access_token_encrypted, refresh_token_encrypted, token_expiry, root_folder_id")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const row = data as IntegrationRow | null
  if (!row) throw new Error("Google Drive não está ligado neste tenant")

  const accessToken = decryptOptional(row.access_token_encrypted)
  const expiry = row.token_expiry ? new Date(row.token_expiry).getTime() : 0

  if (accessToken && expiry > Date.now() + REFRESH_BUFFER_MS) return accessToken

  const refreshToken = decryptOptional(row.refresh_token_encrypted)
  if (!refreshToken) {
    throw new Error("Google Drive sem refresh token. Volta a ligar nas Definições.")
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  })

  if (!res.ok) {
    const texto = await res.text().catch(() => "")
    const msg = `Falha a renovar o token do Google Drive (${res.status})`
    await sb
      .from("google_drive_integrations")
      .update({ sync_error: `${msg}: ${texto.slice(0, 300)}`, updated_at: new Date().toISOString() })
      .eq("id", row.id)
    throw new Error(`${msg}. Volta a ligar o Google Drive nas Definições.`)
  }

  const body = (await res.json()) as { access_token: string; expires_in?: number; refresh_token?: string }
  const novoExpiry = new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString()

  await sb
    .from("google_drive_integrations")
    .update({
      access_token_encrypted: encrypt(body.access_token),
      // O Google normalmente nao devolve refresh_token na renovacao; se
      // devolver (rotacao), persistimos o novo.
      ...(body.refresh_token ? { refresh_token_encrypted: encrypt(body.refresh_token) } : {}),
      token_expiry: novoExpiry,
      sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)

  return body.access_token
}

// ---------------------------------------------------------------------------
// Pastas
// ---------------------------------------------------------------------------

const FOLDER_MIME = "application/vnd.google-apps.folder"

/** Escapa plicas para o parametro `q` da API do Drive. */
function escapeQ(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

/**
 * Procura uma pasta pelo nome (opcionalmente dentro de um pai) e cria-a se nao
 * existir. Idempotente: chamar duas vezes devolve sempre a mesma pasta.
 *
 * Nota sobre drive.file: a pesquisa so' encontra pastas criadas por esta app.
 * Isso e' desejado - evita colidir com pastas homonimas do utilizador.
 */
export async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId?: string | null,
): Promise<string> {
  const clauses = [
    `mimeType='${FOLDER_MIME}'`,
    `name='${escapeQ(name)}'`,
    "trashed=false",
    parentId ? `'${escapeQ(parentId)}' in parents` : "'root' in parents",
  ]
  const url =
    `${DRIVE_API}/files?q=${encodeURIComponent(clauses.join(" and "))}` +
    `&fields=${encodeURIComponent("files(id,name)")}&pageSize=1`

  const encontrada = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (encontrada.ok) {
    const body = (await encontrada.json()) as { files?: { id: string }[] }
    const id = body.files?.[0]?.id
    if (id) return id
  }

  const criada = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  })
  if (!criada.ok) {
    const t = await criada.text().catch(() => "")
    throw new Error(`Erro ao criar pasta no Drive ${criada.status}: ${t.slice(0, 300)}`)
  }
  const body = (await criada.json()) as { id: string }
  return body.id
}

/** Devolve o id da pasta raiz "Projetos Flow" do tenant, criando-a se preciso. */
export async function ensureRootFolder(tenantId: string, accessToken: string): Promise<string> {
  const sb = admin()
  const { data } = await sb
    .from("google_drive_integrations")
    .select("id, root_folder_id")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const row = data as { id: string; root_folder_id: string | null } | null
  if (row?.root_folder_id) return row.root_folder_id

  const folderId = await findOrCreateFolder(accessToken, ROOT_FOLDER_NAME, null)
  if (row?.id) {
    await sb
      .from("google_drive_integrations")
      .update({ root_folder_id: folderId, updated_at: new Date().toISOString() })
      .eq("id", row.id)
  }
  return folderId
}

/**
 * Devolve o id da subpasta do projeto, criando-a se ainda nao existir.
 * Cobre tambem os projetos criados antes desta funcionalidade (lazy).
 */
export async function ensureProjectFolder(
  tenantId: string,
  projectId: string,
  projectName: string,
): Promise<string> {
  const sb = admin()
  const { data } = await sb
    .from("projects")
    .select("drive_folder_id")
    .eq("id", projectId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const existente = (data as { drive_folder_id?: string | null } | null)?.drive_folder_id
  if (existente) return existente

  const token = await getValidDriveToken(tenantId)
  const rootId = await ensureRootFolder(tenantId, token)
  const folderId = await findOrCreateFolder(token, projectName, rootId)

  await sb
    .from("projects")
    .update({ drive_folder_id: folderId, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("tenant_id", tenantId)

  return folderId
}

// ---------------------------------------------------------------------------
// Ficheiros
// ---------------------------------------------------------------------------

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  size: number | null
}

/**
 * Envia um ficheiro para uma pasta do Drive (upload multipart).
 *
 * Multipart e' suficiente e mais simples que resumable para os tamanhos que a
 * app aceita (limite de 20 MB, igual ao das faturas). Se um dia for preciso
 * suportar ficheiros grandes, trocar por resumable aqui, sem mexer no resto.
 */
export async function uploadFileToFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  bytes: Buffer,
): Promise<DriveFile> {
  const metadata = { name: fileName, parents: [folderId] }
  const boundary = `isoflow-${Math.random().toString(36).slice(2)}`

  const corpo = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  const campos = encodeURIComponent("id,name,mimeType,webViewLink,size")
  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${campos}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: new Uint8Array(corpo),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`Erro ao enviar para o Drive ${res.status}: ${t.slice(0, 300)}`)
  }

  const b = (await res.json()) as {
    id: string
    name: string
    mimeType: string
    webViewLink?: string
    size?: string
  }
  return {
    id: b.id,
    name: b.name,
    mimeType: b.mimeType,
    webViewLink: b.webViewLink ?? null,
    size: b.size ? Number(b.size) : null,
  }
}

/**
 * Devolve o conteudo de um ficheiro do Drive, para ser servido por proxy.
 * O token nunca sai do servidor - o utilizador nao precisa de conta Google.
 */
export async function fetchFileContent(
  accessToken: string,
  fileId: string,
): Promise<Response> {
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`Erro ao ler do Drive ${res.status}: ${t.slice(0, 200)}`)
  }
  return res
}

/** Apaga um ficheiro do Drive. Silencioso se ja' nao existir. */
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 404) {
    const t = await res.text().catch(() => "")
    throw new Error(`Erro ao apagar no Drive ${res.status}: ${t.slice(0, 200)}`)
  }
}

/** O Drive esta' ligado neste tenant? (nao lanca) */
export async function isDriveConnected(tenantId: string): Promise<boolean> {
  try {
    const { data } = await admin()
      .from("google_drive_integrations")
      .select("refresh_token_encrypted")
      .eq("tenant_id", tenantId)
      .maybeSingle()
    return Boolean((data as { refresh_token_encrypted?: string | null } | null)?.refresh_token_encrypted)
  } catch {
    return false
  }
}

export { DRIVE_API, DRIVE_UPLOAD_API }
