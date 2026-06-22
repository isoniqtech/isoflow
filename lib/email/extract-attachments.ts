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

/** Extrai URLs candidatas de um bloco de HTML. */
function extractCandidatesFromHtml(html: string): string[] {
  const candidates: string[] = []
  const linkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkRegex.exec(html)) !== null) {
    const url = decodeHtmlEntities(m[1].trim())
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase()
    if (!url.startsWith("http://") && !url.startsWith("https://")) continue
    const urlMatchesPattern = DOWNLOAD_LINK_URL_PATTERNS.some((p) => p.test(url))
    const textMatchesKeyword = DOWNLOAD_LINK_TEXT_KEYWORDS.some((k) => text.includes(k))
    if (urlMatchesPattern || textMatchesKeyword) candidates.push(url)
  }
  return candidates
}

/** Extrai URLs em bruto do texto plano (fallback quando HTML não tem links). */
function extractCandidatesFromText(text: string): string[] {
  const rawUrlRegex = /https?:\/\/[^\s<>"']+/g
  const urls = text.match(rawUrlRegex) ?? []
  return urls.filter((url) =>
    DOWNLOAD_LINK_URL_PATTERNS.some((p) => p.test(url))
  )
}

/**
 * Caso 9 - email sem anexos mas com links de download no corpo HTML ou texto.
 * Procura também em emails RFC822 aninhados (emails reencaminhados dentro de reencaminhados).
 * Faz fetch dos links encontrados e devolve os ficheiros como EmailAttachment[].
 * Só é chamada quando extractAllAttachments devolve lista vazia.
 */
export async function extractLinkedDocuments(
  parsedEmail: ParsedMail,
): Promise<EmailAttachment[]> {
  const allCandidates: string[] = []

  // 1. HTML do email exterior
  if (parsedEmail.html && typeof parsedEmail.html === "string") {
    allCandidates.push(...extractCandidatesFromHtml(parsedEmail.html))
  }

  // 2. Texto plano do email exterior (URLs em bruto, padrão mais restrito)
  if (parsedEmail.text && typeof parsedEmail.text === "string") {
    allCandidates.push(...extractCandidatesFromText(parsedEmail.text))
  }

  // 3. Emails RFC822 aninhados (forwards dentro de forwards)
  for (const att of parsedEmail.attachments ?? []) {
    const mime = normalizeMime(att.contentType)
    if (FORWARDED_MIME_TYPES.has(mime) && att.content) {
      try {
        const nested = await simpleParser(att.content as Buffer)
        if (nested.html && typeof nested.html === "string") {
          allCandidates.push(...extractCandidatesFromHtml(nested.html))
        }
        if (nested.text && typeof nested.text === "string") {
          allCandidates.push(...extractCandidatesFromText(nested.text))
        }
        // Um nível extra de profundidade (triple-forward)
        for (const inner of nested.attachments ?? []) {
          const innerMime = normalizeMime(inner.contentType)
          if (FORWARDED_MIME_TYPES.has(innerMime) && inner.content) {
            try {
              const deep = await simpleParser(inner.content as Buffer)
              if (deep.html && typeof deep.html === "string") {
                allCandidates.push(...extractCandidatesFromHtml(deep.html))
              }
              if (deep.text && typeof deep.text === "string") {
                allCandidates.push(...extractCandidatesFromText(deep.text))
              }
            } catch { /* ignorar */ }
          }
        }
      } catch (e) {
        console.warn("[extractLinkedDocuments] nested parse failed:", e instanceof Error ? e.message : String(e))
      }
    }
  }

  const unique = [...new Set(allCandidates)].slice(0, 5)
  console.log(`[extractLinkedDocuments] links candidatos (${unique.length}):`, unique)
  if (!unique.length) return []

  const result: EmailAttachment[] = []

  for (const url of unique) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15_000)

      let res: Response
      try {
        res = await fetch(url, {
          signal: controller.signal,
          redirect: "follow",
          headers: { "User-Agent": "ISOFlow-InvoiceProcessor/1.0" },
        })
      } finally {
        clearTimeout(timeoutId)
      }

      console.log(`[extractLinkedDocuments] ${url} → status=${res.status} content-type=${res.headers.get("content-type")}`)

      if (!res.ok) {
        console.warn(`[extractLinkedDocuments] resposta não-ok (${res.status}) para ${url}`)
        continue
      }

      let contentType = normalizeMime(res.headers.get("content-type") ?? "")

      // Rejeitar imediatamente tipos claramente irrelevantes (HTML, JSON, etc.)
      // sem ler o body - mas deixar passar octet-stream para verificar magic bytes
      const isOctetStream = contentType === "application/octet-stream"
      if (!RELEVANT_MIME_TYPES.has(contentType) && !isOctetStream) {
        console.warn(`[extractLinkedDocuments] content-type rejeitado: ${contentType} para ${url}`)
        continue
      }

      const buf = Buffer.from(await res.arrayBuffer())
      const size = buf.byteLength
      if (size < MIN_FILE_SIZE || size > MAX_FILE_SIZE) {
        console.warn(`[extractLinkedDocuments] tamanho fora dos limites: ${size} bytes para ${url}`)
        continue
      }

      // Detetar tipo real quando o servidor devolve octet-stream ou tipo desconhecido
      if (isOctetStream || !RELEVANT_MIME_TYPES.has(contentType)) {
        const detected = detectMimeFromBytes(buf)
        if (!detected) {
          console.warn(`[extractLinkedDocuments] magic bytes não reconhecidos para ${url}`)
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

      console.log(`[extractLinkedDocuments] ficheiro obtido: ${filename} (${contentType}, ${size} bytes)`)
      result.push({ filename, mimeType: contentType, base64, size, source: "link", hash })
    } catch (e) {
      console.warn(`[extractLinkedDocuments] fetch falhou para ${url}:`, e instanceof Error ? e.message : String(e))
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
