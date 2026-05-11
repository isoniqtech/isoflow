import imaps, { type ImapSimple } from "imap-simple"
import { simpleParser, type ParsedMail } from "mailparser"

export type EmailProvider = "gmail" | "outlook" | "imap"

export interface EmailCredentials {
  /** Endereço completo do email (usado como user) */
  email: string
  /** App password ou password normal — JÁ desencriptada */
  appPassword: string
  provider: EmailProvider
  /** Para provider 'imap', host customizado. */
  imapHost?: string
  /** Para provider 'imap', porta customizada (default 993). */
  imapPort?: number
  /**
   * Tag de routing tipo "+faturas". Se preenchida, só processamos emails
   * em que o endereço de destino corresponde a `local+tag@domain`.
   */
  tag?: string | null
}

interface ImapHostConfig {
  host: string
  port: number
}

function resolveHost(credentials: EmailCredentials): ImapHostConfig {
  switch (credentials.provider) {
    case "gmail":
      return { host: "imap.gmail.com", port: 993 }
    case "outlook":
      return { host: "outlook.office365.com", port: 993 }
    case "imap":
      if (!credentials.imapHost) {
        throw new Error("imapHost é obrigatório para provider 'imap'")
      }
      return {
        host: credentials.imapHost,
        port: credentials.imapPort ?? 993,
      }
    default:
      throw new Error(`Provider desconhecido: ${credentials.provider}`)
  }
}

/**
 * Cria e devolve uma ligação IMAP autenticada. Caller deve fazer
 * `await connection.end()` quando terminar.
 */
export async function connectToImap(
  credentials: EmailCredentials,
): Promise<ImapSimple> {
  const { host, port } = resolveHost(credentials)

  const config: imaps.ImapSimpleOptions = {
    imap: {
      user: credentials.email,
      password: credentials.appPassword,
      host,
      port,
      tls: true,
      authTimeout: 15000,
      connTimeout: 15000,
      tlsOptions: { servername: host },
    },
  }

  return imaps.connect(config)
}

/**
 * Filtra mensagens cujo To/Cc bate com `<local>+<tag>@<domain>` quando
 * uma tag está configurada. Se não houver tag, aceita todas.
 */
function matchesTag(
  parsed: ParsedMail,
  account: string,
  tag: string | null | undefined,
): boolean {
  if (!tag) return true
  const cleanTag = tag.replace(/^\+/, "").toLowerCase()
  const [local, domain] = account.toLowerCase().split("@")
  if (!local || !domain) return true
  const expected = `${local}+${cleanTag}@${domain}`
  const addresses: string[] = []
  for (const field of ["to", "cc", "bcc"] as const) {
    const f = parsed[field]
    if (!f) continue
    const arr = Array.isArray(f) ? f : [f]
    for (const entry of arr) {
      for (const v of entry.value ?? []) {
        if (v.address) addresses.push(v.address.toLowerCase())
      }
    }
  }
  return addresses.some(
    (a) => a === expected || a.startsWith(`${local}+${cleanTag}@`),
  )
}

/**
 * Busca emails não lidos numa connection JÁ aberta (caller responsável por
 * `connectToImap` + `openBox` antes — ver withInbox helper).
 * Devolve até 50 emails por chamada para evitar abusos / out-of-memory.
 */
export async function fetchNewEmailsOnConnection(
  connection: ImapSimple,
  credentials: EmailCredentials,
): Promise<Array<{ uid: number; parsed: ParsedMail }>> {
  const searchCriteria = ["UNSEEN"]
  const fetchOptions = {
    bodies: [""],
    markSeen: false,
    struct: true,
  }
  const messages = await connection.search(searchCriteria, fetchOptions)
  const limited = messages.slice(0, 50)

  const out: Array<{ uid: number; parsed: ParsedMail }> = []
  for (const msg of limited) {
    const fullPart = msg.parts.find((p) => p.which === "")
    if (!fullPart) continue
    try {
      const parsed = await simpleParser(fullPart.body as string)
      if (matchesTag(parsed, credentials.email, credentials.tag)) {
        out.push({ uid: msg.attributes.uid, parsed })
      }
    } catch (e) {
      console.warn("parse email failed:", e)
    }
  }
  return out
}

/**
 * Conveniência: abre, busca, fecha. Útil para casos pontuais.
 * Para sync com markAsRead a seguir, preferir withInbox + fetchNewEmailsOnConnection.
 */
export async function fetchNewEmails(
  credentials: EmailCredentials,
): Promise<Array<{ uid: number; parsed: ParsedMail }>> {
  return withInbox(credentials, (conn) =>
    fetchNewEmailsOnConnection(conn, credentials),
  )
}

/**
 * Marca uma mensagem como lida (flag \Seen) por UID.
 * Requer uma ligação aberta (chamado pelo orchestrator depois do processo).
 */
export async function markAsRead(
  connection: ImapSimple,
  uid: number,
): Promise<void> {
  await connection.addFlags(uid, ["\\Seen"])
}

/**
 * Testa as credenciais ligando ao IMAP, abrindo a INBOX e fechando.
 * Devolve { success: true } ou { success: false, error: '...' }.
 */
export async function testConnection(
  credentials: EmailCredentials,
): Promise<{ success: boolean; error?: string }> {
  let connection: ImapSimple | null = null
  try {
    connection = await connectToImap(credentials)
    await connection.openBox("INBOX")
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  } finally {
    if (connection) {
      try {
        connection.end()
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Conveniência: faz openBox, executa um callback com a connection aberta,
 * e fecha. Usado pelo orchestrator quando precisa de marcar como lido
 * imediatamente após processar.
 */
export async function withInbox<T>(
  credentials: EmailCredentials,
  fn: (conn: ImapSimple) => Promise<T>,
): Promise<T> {
  const connection = await connectToImap(credentials)
  try {
    await connection.openBox("INBOX")
    return await fn(connection)
  } finally {
    try {
      connection.end()
    } catch {
      // ignore
    }
  }
}
