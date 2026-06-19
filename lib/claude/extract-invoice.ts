import Anthropic from "@anthropic-ai/sdk"
import sharp from "sharp"

const CLAUDE_MODEL = "claude-sonnet-4-6"

/**
 * Claude API rejeita imagens > 5MB base64. Damos uma margem de segurança.
 * Aceitamos PDFs maiores (até 32MB conforme docs), só comprimimos imagens.
 */
const CLAUDE_IMAGE_MAX_BYTES = 4_800_000

export type InvoiceFileType = "pdf" | "jpg" | "jpeg" | "png" | "tiff" | "webp"

export interface InvoiceExtraction {
  supplier_name: string | null
  supplier_nif: string | null
  supplier_email: string | null
  supplier_address: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  vat_rate: number | null
  vat_amount: number | null
  total: number | null
  currency: string
  description: string | null
  category:
    | "transporte"
    | "alimentacao"
    | "tecnologia"
    | "servicos"
    | "material"
    | "combustivel"
    | "comunicacoes"
    | "alojamento"
    | "formacao"
    | "outro"
    | null
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
    vat_rate: number
    total: number
  }>
  confidence: number
  needs_review: boolean
  notes: string | null
}

export const INVOICE_EXTRACTION_PROMPT = `Analisa esta fatura portuguesa e extrai os dados estruturados.

Este ficheiro pode vir de um email reencaminhado várias vezes. Ignora
TODOS os cabeçalhos de reencaminhamento (From/To/Subject/Re:/Fwd:) e
mensagens automáticas. Extrai APENAS os dados da fatura original.

Responde APENAS com JSON válido. Sem texto extra. Sem markdown. Sem backticks.

Schema obrigatório:
{
  "supplier_name": string | null,
  "supplier_nif": string | null,
  "supplier_email": string | null,
  "supplier_address": string | null,
  "invoice_number": string | null,
  "invoice_date": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
  "subtotal": number | null,
  "vat_rate": number | null,
  "vat_amount": number | null,
  "total": number | null,
  "currency": "EUR",
  "description": string | null,
  "category": "transporte"|"alimentacao"|"tecnologia"|"servicos"|"material"|"combustivel"|"comunicacoes"|"alojamento"|"formacao"|"outro",
  "line_items": [{"description": string, "quantity": number, "unit_price": number, "vat_rate": number, "total": number}],
  "confidence": number,
  "needs_review": boolean,
  "notes": string | null
}

Regras estritas:
- confidence: 0.0 a 1.0. Se < 0.7 → needs_review: true.
- Todos os valores monetários são números (não strings).
- NIF português tem 9 dígitos numéricos. Ignora se não for válido.
- Se um campo não for visível ou não confias → null.
- Múltiplos IVAs → usar o predominante em vat_rate.
- invoice_date e due_date no formato YYYY-MM-DD.
- currency sempre "EUR".`

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada no servidor")
  }
  return new Anthropic({ apiKey })
}

function normaliseMediaType(fileType: InvoiceFileType): {
  isImage: boolean
  mediaType: string
} {
  switch (fileType) {
    case "pdf":
      return { isImage: false, mediaType: "application/pdf" }
    case "jpg":
    case "jpeg":
      return { isImage: true, mediaType: "image/jpeg" }
    case "png":
      return { isImage: true, mediaType: "image/png" }
    case "tiff":
      return { isImage: true, mediaType: "image/tiff" }
    case "webp":
      return { isImage: true, mediaType: "image/webp" }
    default:
      return { isImage: true, mediaType: "image/jpeg" }
  }
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif"

function detectImageMediaType(buf: Buffer): ImageMediaType {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "image/png"
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "image/jpeg"
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46)
    return "image/webp"
  return "image/jpeg"
}

/**
 * Comprime imagens grandes para caber no limite da Claude API (5 MB).
 * Deteta o tipo real pelos magic bytes para evitar mismatch MIME/conteúdo.
 */
async function compressImageForClaude(
  inputBase64: string,
): Promise<{ base64: string; mediaType: ImageMediaType }> {
  const input = Buffer.from(inputBase64, "base64")
  if (input.length <= CLAUDE_IMAGE_MAX_BYTES) {
    return { base64: inputBase64, mediaType: detectImageMediaType(input) }
  }
  // Re-encode em JPEG com várias qualidades + downscales até caber.
  const widthSteps = [2400, 1800, 1400, 1100, 900]
  const qualitySteps = [85, 75, 65, 55]
  for (const width of widthSteps) {
    for (const quality of qualitySteps) {
      const out = await sharp(input)
        .rotate() // respeitar EXIF orientation
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()
      if (out.length <= CLAUDE_IMAGE_MAX_BYTES) {
        return { base64: out.toString("base64"), mediaType: "image/jpeg" }
      }
    }
  }
  // Última tentativa: 800px @ 50% — não devia falhar para faturas reais.
  const fallback = await sharp(input)
    .rotate()
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 50, mozjpeg: true })
    .toBuffer()
  return { base64: fallback.toString("base64"), mediaType: "image/jpeg" }
}

/**
 * Envia ficheiro base64 para Claude e devolve dados estruturados.
 * Throws se ANTHROPIC_API_KEY não estiver definida.
 */
export async function extractInvoiceData(
  fileBase64: string,
  fileType: InvoiceFileType,
): Promise<InvoiceExtraction> {
  const client = getClient()
  const { isImage, mediaType } = normaliseMediaType(fileType)

  type ContentBlock =
    | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
    | { type: "text"; text: string }

  // Para imagens, garantir que cabe no limite de 5 MB da Claude API.
  let imageData = fileBase64
  let imageMediaType: ImageMediaType = mediaType as ImageMediaType
  if (isImage) {
    const compressed = await compressImageForClaude(fileBase64)
    imageData = compressed.base64
    imageMediaType = compressed.mediaType
  }

  const content: ContentBlock[] = [
    isImage
      ? {
          type: "image",
          source: {
            type: "base64",
            media_type: imageMediaType,
            data: imageData,
          },
        }
      : {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: fileBase64,
          },
        },
    { type: "text", text: INVOICE_EXTRACTION_PROMPT },
  ]

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content }],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()

  return parseExtractionResponse(text)
}

/**
 * Variante para emails sem anexo — passa só texto (HTML stripped).
 */
export async function extractInvoiceFromText(
  text: string,
): Promise<InvoiceExtraction> {
  const client = getClient()
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${INVOICE_EXTRACTION_PROMPT}\n\nA fatura está no corpo de email abaixo (texto):\n\n${text}`,
          },
        ],
      },
    ],
  })

  const out = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
  return parseExtractionResponse(out)
}

function parseExtractionResponse(text: string): InvoiceExtraction {
  // O modelo às vezes envolve em ```json apesar do prompt. Sanitizamos.
  const clean = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(clean)
  } catch {
    // Fallback: devolver objeto vazio com needs_review=true para o user editar.
    return {
      supplier_name: null,
      supplier_nif: null,
      supplier_email: null,
      supplier_address: null,
      invoice_number: null,
      invoice_date: null,
      due_date: null,
      subtotal: null,
      vat_rate: null,
      vat_amount: null,
      total: null,
      currency: "EUR",
      description: null,
      category: null,
      line_items: [],
      confidence: 0,
      needs_review: true,
      notes: "Parsing JSON da resposta Claude falhou",
    }
  }

  const confidence = clampNumber(parsed.confidence, 0, 1)
  return {
    supplier_name: stringOrNull(parsed.supplier_name),
    supplier_nif: stringOrNull(parsed.supplier_nif),
    supplier_email: stringOrNull(parsed.supplier_email),
    supplier_address: stringOrNull(parsed.supplier_address),
    invoice_number: stringOrNull(parsed.invoice_number),
    invoice_date: stringOrNull(parsed.invoice_date),
    due_date: stringOrNull(parsed.due_date),
    subtotal: numberOrNull(parsed.subtotal),
    vat_rate: numberOrNull(parsed.vat_rate),
    vat_amount: numberOrNull(parsed.vat_amount),
    total: numberOrNull(parsed.total),
    currency:
      typeof parsed.currency === "string" && parsed.currency.length === 3
        ? parsed.currency.toUpperCase()
        : "EUR",
    description: stringOrNull(parsed.description),
    category:
      typeof parsed.category === "string"
        ? (parsed.category as InvoiceExtraction["category"])
        : null,
    line_items: Array.isArray(parsed.line_items)
      ? (parsed.line_items as InvoiceExtraction["line_items"])
      : [],
    confidence,
    needs_review:
      typeof parsed.needs_review === "boolean"
        ? parsed.needs_review
        : confidence < 0.7,
    notes: stringOrNull(parsed.notes),
  }
}

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null
}
function numberOrNull(v: unknown): number | null {
  if (typeof v === "number" && !isNaN(v)) return v
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."))
    return isNaN(n) ? null : n
  }
  return null
}
function clampNumber(v: unknown, min: number, max: number): number {
  const n = numberOrNull(v)
  if (n === null) return 0
  return Math.max(min, Math.min(max, n))
}
