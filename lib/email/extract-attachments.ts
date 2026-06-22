import { createHash } from "crypto"
import JSZip from "jszip"
import {
  simpleParser,
  type ParsedMail,
  type Attachment as MailparserAttachment,
} from "mailparser"

export type AttachmentSource =
  | "attachment"
  | "inline"
  | "forwarded"
  | "zip"
  | "html"
  | "link"

export interface EmailAttachment {
  filename: string
  mimeType: string
  /** Conteúdo do ficheiro em base64 (sem prefixo data:) */
  base64: string
  /** Tamanho em bytes do conteúdo original (não da string base64) */
  size: number
  source: AttachmentSource
  /** SHA-256 hex (calculado por calculateFileHash) */
  hash: string
}

// Tipos relevantes a processar como fatura.
const RELEVANT_MIME_TYPES = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
  "image/webp",
])

// Limites de tamanho dos ficheiros.
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MIN_FILE_SIZE = 1 * 1024 // 1 KB

// Tipos de email reencaminhado (RFC822).
const FORWARDED_MIME_TYPES = new Set<string>([
  "message/rfc822",
  "application/rfc822",
])

const ZIP_MIME_TYPES = new Set<string>([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "multipart/x-zip",
])

/** SHA-256 hex do conteúdo (base64 → bytes → hash). */
export function calculateFileHash(base64: string): string {
  const buf = Buffer.from(base64, "base64")
  return createHash("sha256").update(buf).digest("hex")
}

/** Devolve a extensão a usar para um mimeType conhecido. */
function extensionForMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case "application/pdf":
      return "pdf"
    case "image/jpeg":
    case "image/jpg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/tiff":
      return "tiff"
    case "image/webp":
      return "webp"
    default:
      return "bin"
  }
}

function normalizeMime(mime: string | undefined): string {
  if (!mime) return ""
  return mime.toLowerCase().split(";")[0].trim()
}

/** Filtra anexos por tamanho + tipo relevante. */
function isRelevant(a: { mimeType: string; size: number }): boolean {
  if (!RELEVANT_MIME_TYPES.has(a.mimeType)) return false
  if (a.size < MIN_FILE_SIZE) return false
  if (a.size > MAX_FILE_SIZE) return false
  return true
}

/** Converte um mailparser Attachment numa entrada normalizada. */
function fromMailparserAttachment(
  a: MailparserAttachment,
  source: AttachmentSource,
): EmailAttachment | null {
  const mime = normalizeMime(a.contentType)
  const content = a.content as Buffer | undefined
  if (!content) return null
  const size = content.byteLength
  const base64 = content.toString("base64")
  const filename =
    a.filename ??
    `attachment-${createHash("md5").update(base64.slice(0, 64)).digest("hex").slice(0, 8)}.${extensionForMime(mime)}`
  return {
    filename,
    mimeType: mime,
    base64,
    size,
    source,
    hash: createHash("sha256").update(content).digest("hex"),
  }
}

/**
 * Extrai TODOS os anexos relevantes (PDFs/imagens) de um email,
 * processando recursivamente emails reencaminhados, imagens inline,
 * imagens base64 no HTML e ZIPs.
 *
 * Retorna apenas anexos no intervalo de tamanho aceitável e de tipos
 * suportados pela extração IA (PDFs e imagens raster).
 */
export async function extractAllAttachments(
  parsedEmail: ParsedMail,
): Promise<EmailAttachment[]> {
  const result: EmailAttachment[] = []

  // CASO 1 + 2 + 6 + 3 — anexos do nível atual
  for (const att of parsedEmail.attachments ?? []) {
    const mime = normalizeMime(att.contentType)

    // CASO 3 — email reencaminhado (RFC822). Parse recursivo.
    if (FORWARDED_MIME_TYPES.has(mime) && att.content) {
      try {
        const nested = await simpleParser(att.content as Buffer)
        const nestedAtts = await extractAllAttachments(nested)
        for (const na of nestedAtts) {
          // marca como "forwarded" (override do source original)
          result.push({ ...na, source: "forwarded" })
        }
      } catch (e) {
        console.warn("forwarded email parse failed:", e)
      }
      continue
    }

    // CASO 6 — ZIP com PDFs/imagens dentro
    if (ZIP_MIME_TYPES.has(mime) && att.content) {
      try {
        const zip = await JSZip.loadAsync(att.content as Buffer)
        for (const entryName of Object.keys(zip.files)) {
          const entry = zip.files[entryName]
          if (entry.dir) continue
          const innerName = entryName.split("/").pop() ?? entryName
          const ext = innerName.split(".").pop()?.toLowerCase() ?? ""
          const guessedMime =
            ext === "pdf"
              ? "application/pdf"
              : ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : ext === "png"
                  ? "image/png"
                  : ext === "tiff"
                    ? "image/tiff"
                    : ext === "webp"
                      ? "image/webp"
                      : ""
          if (!RELEVANT_MIME_TYPES.has(guessedMime)) continue
          const buf = await entry.async("nodebuffer")
          const size = buf.byteLength
          if (size < MIN_FILE_SIZE || size > MAX_FILE_SIZE) continue
          result.push({
            filename: innerName,
            mimeType: guessedMime,
            base64: buf.toString("base64"),
            size,
            source: "zip",
            hash: createHash("sha256").update(buf).digest("hex"),
          })
        }
      } catch (e) {
        console.warn("zip extract failed:", e)
      }
      continue
    }

    // CASO 4 — imagens inline (Content-ID)
    const isInline =
      att.contentDisposition === "inline" ||
      Boolean(att.cid) ||
      Boolean((att as { related?: boolean }).related)

    // CASO 1 + 2 — anexos diretos (PDF/imagem)
    if (RELEVANT_MIME_TYPES.has(mime)) {
      const normalized = fromMailparserAttachment(
        att,
        isInline ? "inline" : "attachment",
      )
      if (normalized && isRelevant(normalized)) {
        result.push(normalized)
      }
    }
  }

  // CASO 5 — imagens base64 embed no HTML (data: URI)
  if (parsedEmail.html && typeof parsedEmail.html === "string") {
    const html = parsedEmail.html
    const dataUriRegex =
      /data:(image\/(?:jpeg|jpg|png|tiff|webp));base64,([A-Za-z0-9+/=\s]+)/g
    let m: RegExpExecArray | null
    let idx = 0
    while ((m = dataUriRegex.exec(html)) !== null) {
      idx += 1
      const mime = m[1].toLowerCase()
      const base64Raw = m[2].replace(/\s/g, "")
      const buf = Buffer.from(base64Raw, "base64")
      const size = buf.byteLength
      if (size < MIN_FILE_SIZE || size > MAX_FILE_SIZE) continue
      if (!RELEVANT_MIME_TYPES.has(mime)) continue
      result.push({
        filename: `inline-${idx}.${extensionForMime(mime)}`,
        mimeType: mime,
        base64: base64Raw,
        size,
        source: "html",
        hash: createHash("sha256").update(buf).digest("hex"),
      })
    }
  }

  return result
}

/**
 * Remove duplicados pelo hash do conteúdo. Mantém o primeiro encontrado.
 */
export function deduplicateAttachments(
  attachments: EmailAttachment[],
): EmailAttachment[] {
  const seen = new Set<string>()
  const out: EmailAttachment[] = []
  for (const a of attachments) {
    if (seen.has(a.hash)) continue
    seen.add(a.hash)
    out.push(a)
  }
  return out
}

/**
 * Caso 8 — fatura inteira em HTML sem anexo. Devolve o texto plano
 * (HTML stripped) que pode ser enviado ao Claude como prompt textual.
 * Retorna null se o email não tem corpo HTML utilizável.
 */
export function htmlBodyAsText(parsedEmail: ParsedMail): string | null {
  const html = parsedEmail.html
  if (!html || typeof html !== "string") return null
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > 80 ? text : null
}

const DOWNLOAD_LINK_URL_PATTERNS = [
  /\.(pdf|jpg|jpeg|png)(\?[^"'\s]*)?$/i,
  /\/(download|invoice|fatura|factura|document|documento|ficheiro|file|attachment|anexo|partilha|share|view)\b/i,
]

const DOWNLOAD_LINK_TEXT_KEYWORDS = [
  "download", "descarregar", "baixar",
  "fatura", "factura", "invoice", "recibo", "receipt",
  "documento", "document", "pdf",
  "ver", "abrir", "aceder", "acesso", "consultar", "visualizar",
  "partilha", "partilhado", "clique aqui", "click here",
]

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
}

function detectMimeFromBytes(buf: Buffer): string | null {
  if (buf.length < 4) return null
  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf"
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg"
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png"
  return null
}

// URLs que nunca são documentos - excluídas no fallback
const SKIP_URL_PATTERNS = [
  /unsubscribe/i, /optout/i, /opt-out/i,
  /[?&]track/i, /\/pixel/i, /\/beacon/i,
  /facebook\.com/i, /twitter\.com/i, /linkedin\.com/i,
  /instagram\.com/i, /youtube\.com/i,
]

function isHttpUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://")
}

/** Extrai todos os hrefs http(s) de HTML. */
function allHrefsFromHtml(html: string): string[] {
  const urls: string[] = []
  const hrefRegex = /href=["']([^"'#][^"']*?)["']/gi
  let m: RegExpExecArray | null
  while ((m = hrefRegex.exec(html)) !== null) {
    const url = decodeHtmlEntities(m[1].trim())
    if (isHttpUrl(url)) urls.push(url)
  }
  return urls
}

/** Extrai todos os URLs http(s) em bruto de texto plano. */
function allUrlsFromText(text: string): string[] {
  return (text.match(/https?:\/\/[^\s<>"']+/g) ?? [])
}

/** Extrai URLs "fortes" de HTML: link cujo URL ou texto ancora sugere documento. */
function strongCandidatesFromHtml(html: string): string[] {
  const candidates: string[] = []
  const linkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkRegex.exec(html)) !== null) {
    const url = decodeHtmlEntities(m[1].trim())
    if (!isHttpUrl(url)) continue
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase()
    const urlMatch = DOWNLOAD_LINK_URL_PATTERNS.some((p) => p.test(url))
    const textMatch = DOWNLOAD_LINK_TEXT_KEYWORDS.some((k) => text.includes(k))
    if (urlMatch || textMatch) candidates.push(url)
  }
  return candidates
}

/** Recolhe todos os emails de um ParsedMail até depth níveis de RFC822. */
async function collectEmails(root: ParsedMail, depth = 2): Promise<ParsedMail[]> {
  const emails: ParsedMail[] = [root]
  if (depth <= 0) return emails
  for (const att of root.attachments ?? []) {
    const mime = normalizeMime(att.contentType)
    if (FORWARDED_MIME_TYPES.has(mime) && att.content) {
      try {
        const nested = await simpleParser(att.content as Buffer)
        const children = await collectEmails(nested, depth - 1)
        emails.push(...children)
      } catch { /* ignorar */ }
    }
  }
  return emails
}

export interface LinkExtractionDebug {
  triedUrls: string[]
  results: Array<{ url: string; outcome: string }>
}

/**
 * Caso 9 - email sem anexos mas com links de download.
 * Estratégia em dois passos:
 *   1. Candidatos fortes (URL pattern + texto ancora) em todos os níveis RFC822
 *   2. Fallback: todos os https links de todos os níveis, excluindo não-documentos
 * O content-type da resposta HTTP é o árbitro final.
 */
export async function extractLinkedDocuments(
  parsedEmail: ParsedMail,
  debug?: LinkExtractionDebug,
): Promise<EmailAttachment[]> {
  // Recolher todos os emails aninhados (até 2 níveis de forward)
  const emails = await collectEmails(parsedEmail, 2)

  // Passo 1: candidatos fortes
  const strong: string[] = []
  for (const email of emails) {
    if (email.html && typeof email.html === "string") {
      strong.push(...strongCandidatesFromHtml(email.html))
    }
    if (email.text && typeof email.text === "string") {
      const textUrls = allUrlsFromText(email.text)
      strong.push(...textUrls.filter((u) => DOWNLOAD_LINK_URL_PATTERNS.some((p) => p.test(u))))
    }
  }

  // Passo 2: fallback - todos os links (se passo 1 ficou vazio)
  const fallback: string[] = []
  if (strong.length === 0) {
    for (const email of emails) {
      if (email.html && typeof email.html === "string") {
        fallback.push(...allHrefsFromHtml(email.html))
      }
      if (email.text && typeof email.text === "string") {
        fallback.push(...allUrlsFromText(email.text))
      }
    }
  }

  const pool = strong.length > 0 ? strong : fallback
  const unique = [...new Set(pool)]
    .filter((u) => !SKIP_URL_PATTERNS.some((p) => p.test(u)))
    .slice(0, 8)

  console.log(`[eld] e=${emails.length} str=${strong.length} fb=${fallback.length} try=${unique.length}`)
  unique.forEach((u, i) => console.log(`[eld:${i}] ${u.slice(0, 100)}`))
  if (debug) debug.triedUrls = [...unique]
  if (!unique.length) return []

  const result: EmailAttachment[] = []

  for (const url of unique) {
    let outcome = "unknown"
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15_000)

      let res: Response
      try {
        res = await fetch(url, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/pdf,image/*,application/octet-stream,*/*;q=0.8",
            "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
          },
        })
      } finally {
        clearTimeout(timeoutId)
      }

      const rawCt = res.headers.get("content-type") ?? ""
      console.log(`[eld:fetch] ${res.status} ct=${rawCt.slice(0,40)}`)

      if (!res.ok) {
        outcome = `http_${res.status}`
        console.warn(`[eld:fail] status=${res.status}`)
        debug?.results.push({ url, outcome })
        continue
      }

      let contentType = normalizeMime(rawCt)
      const isOctetStream = contentType === "application/octet-stream"
      if (!RELEVANT_MIME_TYPES.has(contentType) && !isOctetStream) {
        outcome = `bad_ct:${contentType.slice(0, 40)}`
        console.warn(`[eld:skip] ct=${contentType}`)
        debug?.results.push({ url, outcome })
        continue
      }

      const buf = Buffer.from(await res.arrayBuffer())
      const size = buf.byteLength
      if (size < MIN_FILE_SIZE || size > MAX_FILE_SIZE) {
        outcome = `bad_size:${size}`
        console.warn(`[eld:skip] size=${size}`)
        debug?.results.push({ url, outcome })
        continue
      }

      if (isOctetStream || !RELEVANT_MIME_TYPES.has(contentType)) {
        const detected = detectMimeFromBytes(buf)
        if (!detected) {
          outcome = "bad_magic"
          console.warn(`[eld:skip] magic unknown`)
          debug?.results.push({ url, outcome })
          continue
        }
        contentType = detected
      }

      const disposition = res.headers.get("content-disposition") ?? ""
      const filenameMatch = disposition.match(/filename[*]?=(?:UTF-8'')?["']?([^"';\r\n]+)/i)
      const urlFilename = url.split("/").pop()?.split("?")[0] ?? ""
      const rawFilename = filenameMatch?.[1]?.trim() ?? urlFilename
      const filename = rawFilename || `documento.${extensionForMime(contentType)}`

      const base64 = buf.toString("base64")
      const hash = createHash("sha256").update(buf).digest("hex")

      outcome = `ok:${contentType}:${size}b`
      console.log(`[eld:ok] ${filename} ${contentType} ${size}b`)
      debug?.results.push({ url, outcome })
      result.push({ filename, mimeType: contentType, base64, size, source: "link", hash })
    } catch (e) {
      outcome = `err:${e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60)}`
      console.warn(`[eld:err]`, outcome)
      debug?.results.push({ url, outcome })
    }
  }

  return result
}

export {
  RELEVANT_MIME_TYPES,
  MAX_FILE_SIZE,
  MIN_FILE_SIZE,
  extensionForMime,
}
