import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { extractInvoiceData } from "@/lib/claude/extract-invoice"
import type { InvoiceFileType } from "@/lib/claude/extract-invoice"
import {
  matchCreditNoteToInvoice,
  matchPendingCreditNotesToInvoice,
} from "@/lib/utils/credit-note-match"

const BUCKET = process.env.INVOICE_FILES_BUCKET ?? "invoice-files"
const MAX_AI_ATTEMPTS = 20

export interface ReprocessResult {
  invoiceId: string
  ok: boolean
  supplierName: string | null
  confidence: number
  error?: string
}

/**
 * Re-extrai dados de uma fatura ja existente a partir do ficheiro no Storage.
 * Incrementa ai_attempts em cada chamada. Para de tentar apos MAX_AI_ATTEMPTS.
 */
export async function reprocessInvoice(
  invoiceId: string,
  tenantId: string,
  supabase: SupabaseClient<Database>,
  adminStorage: SupabaseClient<Database>,
): Promise<ReprocessResult> {
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, file_path, file_type, ai_attempts")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (fetchErr || !invoice) {
    return { invoiceId, ok: false, supplierName: null, confidence: 0, error: "Not found" }
  }
  if (!invoice.file_path) {
    return { invoiceId, ok: false, supplierName: null, confidence: 0, error: "No file" }
  }

  const attempts = (invoice.ai_attempts ?? 0) + 1
  const now = new Date().toISOString()

  // Registar esta tentativa antes de chamar a API
  await supabase
    .from("invoices")
    .update({ ai_attempts: attempts, ai_last_attempt_at: now })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)

  // Download do ficheiro do Storage
  const { data: fileData, error: dlErr } = await adminStorage.storage
    .from(BUCKET)
    .download(invoice.file_path)

  if (dlErr || !fileData) {
    await supabase
      .from("invoices")
      .update({ notes: `Storage error: ${dlErr?.message}` })
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
    return { invoiceId, ok: false, supplierName: null, confidence: 0, error: `Storage: ${dlErr?.message}` }
  }

  const fileBase64 = Buffer.from(await fileData.arrayBuffer()).toString("base64")
  const fileType = (invoice.file_type ?? "pdf") as InvoiceFileType

  let extraction
  try {
    extraction = await extractInvoiceData(fileBase64, fileType)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabase
      .from("invoices")
      .update({ notes: `AI failed: ${msg}`, ai_last_attempt_at: now })
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
    return { invoiceId, ok: false, supplierName: null, confidence: 0, error: `AI: ${msg}` }
  }

  const { error: updateErr } = await supabase
    .from("invoices")
    .update({
      supplier_name: extraction.supplier_name,
      supplier_nif: extraction.supplier_nif,
      supplier_email: extraction.supplier_email,
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
      document_kind: extraction.document_kind,
      referenced_document_number: extraction.referenced_document_number,
      ai_confidence: extraction.confidence,
      ai_raw_response: extraction as never,
      ai_processed_at: now,
      ai_last_attempt_at: now,
      needs_review: extraction.needs_review || extraction.confidence < 0.7,
      notes: extraction.notes,
    })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)

  if (updateErr) {
    return { invoiceId, ok: false, supplierName: null, confidence: 0, error: `DB: ${updateErr.message}` }
  }

  // Matching FC<->NCF apos a (re)classificacao (nao bloqueia o resultado).
  try {
    const matchable = {
      id: invoiceId,
      tenant_id: tenantId,
      document_kind: extraction.document_kind,
      referenced_document_number: extraction.referenced_document_number,
      invoice_number: extraction.invoice_number,
      supplier_nif: extraction.supplier_nif,
    }
    if (extraction.document_kind === "credit_note") {
      await matchCreditNoteToInvoice(supabase, matchable)
    } else {
      await matchPendingCreditNotesToInvoice(supabase, matchable)
    }
  } catch {
    // best-effort: uma falha de matching nao invalida a reprocessamento
  }

  return { invoiceId, ok: true, supplierName: extraction.supplier_name, confidence: extraction.confidence }
}

/**
 * Encontra faturas com extracao AI falhada para reprocessar.
 * Sem limite de data - usa ai_attempts para parar apos MAX_AI_ATTEMPTS.
 * Ordena por menos tentativas primeiro para priorizar as mais recentes.
 */
export async function findFailedExtractions(
  tenantId: string,
  supabase: SupabaseClient<Database>,
  limit = 10,
): Promise<string[]> {
  const { data } = await supabase
    .from("invoices")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("supplier_name", null)
    .not("file_path", "is", null)
    .eq("needs_review", true)
    .lt("ai_attempts", MAX_AI_ATTEMPTS)
    .neq("status", "rejected")
    .neq("status", "duplicate")
    .order("ai_attempts", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? []).map((r) => r.id)
}
