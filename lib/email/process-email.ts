import type { SupabaseClient } from "@supabase/supabase-js"
import type { ParsedMail } from "mailparser"
import type { Database } from "@/types/supabase"
import {
  deduplicateAttachments,
  extractAllAttachments,
  extractLinkedDocuments,
  htmlBodyAsText,
  type EmailAttachment,
  type LinkExtractionDebug,
} from "@/lib/email/extract-attachments"
import {
  extractInvoiceData,
  extractInvoiceFromText,
  type InvoiceExtraction,
  type InvoiceFileType,
} from "@/lib/claude/extract-invoice"
import { matchProjectFromText } from "@/lib/utils/projects"
import { debitCredits } from "@/lib/utils/credits"
import { log as auditLog } from "@/lib/utils/audit"
import { forwardInvoiceToN8N } from "@/lib/webhooks/n8n"

type Client = SupabaseClient<Database>

export interface ProcessingResult {
  skipped: boolean
  reason?:
    | "already_processed"
    | "no_credits"
    | "no_relevant_attachments"
    | "tenant_not_found"
  emailMessageId: string
  fromEmail: string | null
  subject: string | null
  attachmentsFound: number
  attachmentsProcessed: number
  invoicesCreated: number
  duplicatesSkipped: number
  errors: number
  invoiceIds: string[]
  details: Array<{
    filename: string
    status: "created" | "duplicate" | "skipped" | "error"
    message?: string
    invoice_id?: string
  }>
}

const BUCKET = process.env.INVOICE_FILES_BUCKET || "invoice-files"
const CREDITS_PER_INVOICE = 1

function senderAddress(parsed: ParsedMail): {
  name: string | null
  email: string | null
} {
  const from = parsed.from
  if (!from) return { name: null, email: null }
  const first = from.value?.[0]
  return {
    name: first?.name ?? null,
    email: first?.address ?? null,
  }
}

function fileTypeFromMime(mime: string): InvoiceFileType | null {
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
      return null
  }
}

function bodyText(parsed: ParsedMail): string {
  const parts: string[] = []
  if (parsed.subject) parts.push(parsed.subject)
  if (parsed.text) parts.push(parsed.text)
  const htmlText = htmlBodyAsText(parsed)
  if (htmlText) parts.push(htmlText)
  return parts.join("\n")
}

/**
 * Processa um email completo: extrai anexos, faz dedup (3 níveis), corre
 * Claude AI, cria invoice, debita créditos, faz match de projeto, envia
 * para n8n se configurado, e regista tudo no log.
 *
 * Caller deve depois marcar o email como lido no IMAP.
 */
export async function processEmailInvoice(
  email: ParsedMail,
  tenantId: string,
  supabase: Client,
): Promise<ProcessingResult> {
  const messageId = email.messageId ?? `mid-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const sender = senderAddress(email)
  const subject = email.subject ?? null

  const result: ProcessingResult = {
    skipped: false,
    emailMessageId: messageId,
    fromEmail: sender.email,
    subject,
    attachmentsFound: 0,
    attachmentsProcessed: 0,
    invoicesCreated: 0,
    duplicatesSkipped: 0,
    errors: 0,
    invoiceIds: [],
    details: [],
  }

  // 1. Nível 1 — email já processado com sucesso?
  // Só consideramos "já processado" quando houve invoice criada ou duplicado
  // detectado. Falhas (sem créditos, parsing falhado, etc.) devem poder
  // ser retentadas em próximas sincronizações.
  const { data: existing } = await supabase
    .from("email_processing_log")
    .select("id, invoices_created, duplicates_skipped")
    .eq("tenant_id", tenantId)
    .eq("email_message_id", messageId)
    .or("invoices_created.gt.0,duplicates_skipped.gt.0")
    .maybeSingle()
  if (existing) {
    return { ...result, skipped: true, reason: "already_processed" }
  }

  // 2. Verificar créditos
  const { data: tenant } = await supabase
    .from("tenants")
    .select("credits_balance, app_name, name")
    .eq("id", tenantId)
    .maybeSingle()
  if (!tenant) {
    return { ...result, skipped: true, reason: "tenant_not_found" }
  }
  if ((tenant.credits_balance ?? 0) < CREDITS_PER_INVOICE) {
    // Log sem processar (poderíamos enviar email aviso ao owner aqui).
    await supabase.from("email_processing_log").insert({
      tenant_id: tenantId,
      email_message_id: messageId,
      from_email: sender.email,
      subject,
      attachments_found: 0,
      attachments_processed: 0,
      invoices_created: 0,
      duplicates_skipped: 0,
      errors: 0,
      status: "error",
      details: [{ status: "skipped", message: "Sem créditos" }] as unknown as Database["public"]["Tables"]["email_processing_log"]["Insert"]["details"],
    })
    return { ...result, skipped: true, reason: "no_credits" }
  }

  // 3. Extrair anexos
  const raw = await extractAllAttachments(email)
  let attachments = deduplicateAttachments(raw)

  // Caso 9 — sem anexos mas com links de download no corpo do email
  if (attachments.length === 0) {
    const linkDebug: LinkExtractionDebug = { triedUrls: [], results: [] }
    const linked = await extractLinkedDocuments(email, linkDebug)
    if (linked.length > 0) {
      attachments = deduplicateAttachments(linked)
    } else if (linkDebug.triedUrls.length > 0) {
      // Guardar debug nos details para diagnóstico via DB
      result.details.push({
        filename: "_link_debug",
        status: "skipped",
        message: JSON.stringify({ tried: linkDebug.triedUrls, results: linkDebug.results }),
      })
    }
  }

  result.attachmentsFound = attachments.length

  // Caso 8 — fatura inteira em HTML (sem anexo relevante)
  let htmlText: string | null = null
  if (attachments.length === 0) {
    htmlText = htmlBodyAsText(email)
    if (!htmlText) {
      await supabase.from("email_processing_log").insert({
        tenant_id: tenantId,
        email_message_id: messageId,
        from_email: sender.email,
        subject,
        attachments_found: 0,
        attachments_processed: 0,
        invoices_created: 0,
        duplicates_skipped: 0,
        errors: 0,
        status: "success",
        details: [],
      })
      return { ...result, skipped: true, reason: "no_relevant_attachments" }
    }
  }

  // Match de projeto pelo texto do email (assunto + corpo).
  const matchText = bodyText(email)
  const projectId = await matchProjectFromText(matchText, tenantId, supabase)

  // 4. Processar cada anexo (ou HTML body como uma "fatura")
  const items: Array<EmailAttachment | { html: string }> =
    attachments.length > 0
      ? attachments
      : [{ html: htmlText as string }]

  for (const item of items) {
    const isAtt = "filename" in item
    const filename = isAtt ? item.filename : "email-body.html"

    try {
      // Nível 2 — hash já existe?
      if (isAtt) {
        const { data: existingByHash } = await supabase
          .from("invoices")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("file_hash", item.hash)
          .maybeSingle()
        if (existingByHash) {
          result.duplicatesSkipped += 1
          result.details.push({
            filename,
            status: "duplicate",
            message: "Ficheiro já existe (hash match)",
          })
          continue
        }
      }

      // Upload para Storage (só para anexos reais)
      let filePath: string | null = null
      if (isAtt) {
        const ext = filename.split(".").pop()?.toLowerCase() ?? "bin"
        const uuid = crypto.randomUUID()
        filePath = `${tenantId}/${uuid}.${ext}`
        const buf = Buffer.from(item.base64, "base64")
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, buf, {
            contentType: item.mimeType,
            upsert: false,
          })
        if (upErr) {
          result.errors += 1
          result.details.push({
            filename,
            status: "error",
            message: `Storage upload: ${upErr.message}`,
          })
          continue
        }
      }

      // Claude AI extraction
      let extraction: InvoiceExtraction
      try {
        if (isAtt) {
          const ft = fileTypeFromMime(item.mimeType)
          if (!ft) {
            result.errors += 1
            result.details.push({
              filename,
              status: "error",
              message: `Tipo MIME não suportado: ${item.mimeType}`,
            })
            continue
          }
          extraction = await extractInvoiceData(item.base64, ft)
        } else {
          extraction = await extractInvoiceFromText(item.html)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        // Cria invoice mesmo sem extração — needs_review=true
        extraction = {
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
          description: subject,
          category: null,
          line_items: [],
          confidence: 0,
          needs_review: true,
          notes: `AI failed: ${msg}`,
        }
        result.errors += 1
      }

      // Nível 3 — dados lógicos já existem?
      if (
        extraction.supplier_nif &&
        extraction.invoice_number &&
        extraction.invoice_date
      ) {
        const { data: existingByData } = await supabase
          .from("invoices")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("supplier_nif", extraction.supplier_nif)
          .eq("invoice_number", extraction.invoice_number)
          .eq("invoice_date", extraction.invoice_date)
          .neq("status", "rejected")
          .maybeSingle()
        if (existingByData) {
          result.duplicatesSkipped += 1
          result.details.push({
            filename,
            status: "duplicate",
            message: `Fatura já existe — ${extraction.invoice_number}`,
          })
          continue
        }
      }

      // Criar invoice
      const { data: inserted, error: insertErr } = await supabase
        .from("invoices")
        .insert({
          tenant_id: tenantId,
          project_id: projectId,
          type: "incoming",
          status: "pending",
          source: "email",
          supplier_name: extraction.supplier_name,
          supplier_nif: extraction.supplier_nif,
          supplier_email: extraction.supplier_email ?? sender.email,
          supplier_address: extraction.supplier_address,
          invoice_number: extraction.invoice_number,
          invoice_date: extraction.invoice_date,
          due_date: extraction.due_date,
          subtotal: extraction.subtotal,
          vat_rate: extraction.vat_rate,
          vat_amount: extraction.vat_amount,
          total: extraction.total,
          currency: extraction.currency,
          description: extraction.description,
          category: extraction.category,
          sent_by: sender.name,
          sender_email: sender.email,
          file_path: filePath,
          file_name: isAtt ? filename : null,
          file_type: isAtt ? fileTypeFromMime(item.mimeType) : null,
          file_size_bytes: isAtt ? item.size : null,
          file_hash: isAtt ? item.hash : null,
          email_message_id: messageId,
          email_subject: subject,
          ai_confidence: extraction.confidence,
          ai_raw_response: extraction as unknown as Database["public"]["Tables"]["invoices"]["Insert"]["ai_raw_response"],
          ai_processed_at: new Date().toISOString(),
          needs_review:
            extraction.needs_review || extraction.confidence < 0.7,
          notes: extraction.notes,
        })
        .select("id, supplier_name, supplier_nif, invoice_number, invoice_date, total, currency, description, category, source, file_path")
        .single()

      if (insertErr || !inserted) {
        // Pode ser violation de unique index (race) — tratar como duplicado
        if (insertErr?.code === "23505") {
          result.duplicatesSkipped += 1
          result.details.push({
            filename,
            status: "duplicate",
            message: "Unique constraint (race condition)",
          })
        } else {
          result.errors += 1
          result.details.push({
            filename,
            status: "error",
            message: insertErr?.message ?? "Insert falhou",
          })
        }
        continue
      }

      // Debitar 1 crédito
      const debit = await debitCredits(supabase, {
        tenantId,
        amount: CREDITS_PER_INVOICE,
        description: `Fatura email — ${inserted.supplier_name ?? sender.email}`,
        referenceId: inserted.id,
        referenceType: "invoice",
      })
      if (!debit.ok) {
        // Não rollback automático — manda só log e continua
        console.warn("debit credits failed:", debit)
      }

      // n8n forwarder — forwardInvoiceToN8N trata de tudo (decrypt secret,
      // gerar signed URL, atualizar invoice.erp_synced).
      let n8nForward: Awaited<ReturnType<typeof forwardInvoiceToN8N>> | null = null
      try {
        n8nForward = await forwardInvoiceToN8N(supabase, inserted.id, tenantId)
      } catch (e) {
        console.warn("n8n forward failed:", e)
      }

      result.invoicesCreated += 1
      result.attachmentsProcessed += 1
      result.invoiceIds.push(inserted.id)
      result.details.push({
        filename,
        status: "created",
        invoice_id: inserted.id,
        message: `${inserted.supplier_name ?? "?"} · ${inserted.invoice_number ?? "—"}`,
      })

      await auditLog(supabase, {
        action: "invoice.created",
        tenantId,
        userId: null,
        resourceType: "invoice",
        resourceId: inserted.id,
        metadata: {
          source: "email",
          confidence: extraction.confidence,
          n8n_sent: n8nForward?.ok ?? false,
          n8n_skipped: n8nForward?.skipped ?? false,
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors += 1
      result.details.push({ filename, status: "error", message: msg })
    }
  }

  const status: "success" | "partial" | "error" =
    result.errors === 0 && result.invoicesCreated > 0
      ? "success"
      : result.errors > 0 && result.invoicesCreated > 0
        ? "partial"
        : result.errors > 0
          ? "error"
          : "success"

  await supabase.from("email_processing_log").insert({
    tenant_id: tenantId,
    email_message_id: messageId,
    from_email: sender.email,
    subject,
    attachments_found: result.attachmentsFound,
    attachments_processed: result.attachmentsProcessed,
    invoices_created: result.invoicesCreated,
    duplicates_skipped: result.duplicatesSkipped,
    errors: result.errors,
    status,
    details: result.details as unknown as Database["public"]["Tables"]["email_processing_log"]["Insert"]["details"],
  })

  return result
}
