import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { extractInvoiceData } from "@/lib/claude/extract-invoice"
import type { InvoiceFileType } from "@/lib/claude/extract-invoice"

const BUCKET = process.env.INVOICE_FILES_BUCKET ?? "invoice-files"

export interface ReprocessResult {
  invoiceId: string
  ok: boolean
  supplierName: string | null
  confidence: number
  error?: string
}

/**
 * Re-extrai dados de uma fatura ja existente a partir do ficheiro no Storage.
 * Usa o adminClient para aceder ao Storage sem restricoes RLS.
 * Actualiza a fatura na DB com os novos dados.
 */
export async function reprocessInvoice(
  invoiceId: string,
  tenantId: string,
  supabase: SupabaseClient<Database>,
  adminStorage: SupabaseClient<Database>,
): Promise<ReprocessResult> {
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, file_path, file_type")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (fetchErr || !invoice) {
    return { invoiceId, ok: false, supplierName: null, confidence: 0, error: "Not found" }
  }
  if (!invoice.file_path) {
    return { invoiceId, ok: false, supplierName: null, confidence: 0, error: "No file" }
  }

  const { data: fileData, error: dlErr } = await adminStorage.storage
    .from(BUCKET)
    .download(invoice.file_path)

  if (dlErr || !fileData) {
    return { invoiceId, ok: false, supplierName: null, confidence: 0, error: `Storage: ${dlErr?.message}` }
  }

  const fileBase64 = Buffer.from(await fileData.arrayBuffer()).toString("base64")
  const fileType = (invoice.file_type ?? "pdf") as InvoiceFileType

  let extraction
  try {
    extraction = await extractInvoiceData(fileBase64, fileType)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
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
      ai_confidence: extraction.confidence,
      ai_raw_response: extraction as never,
      ai_processed_at: new Date().toISOString(),
      needs_review: extraction.needs_review || extraction.confidence < 0.7,
      notes: extraction.notes,
    })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)

  if (updateErr) {
    return { invoiceId, ok: false, supplierName: null, confidence: 0, error: `DB: ${updateErr.message}` }
  }

  return {
    invoiceId,
    ok: true,
    supplierName: extraction.supplier_name,
    confidence: extraction.confidence,
  }
}

/**
 * Encontra faturas com extração AI falhada (sem dados, com ficheiro).
 * Limitado a faturas criadas nos ultimos `maxAgeDays` dias para evitar
 * reprocessar faturas antigas propositadamente sem dados.
 */
export async function findFailedExtractions(
  tenantId: string,
  supabase: SupabaseClient<Database>,
  maxAgeDays = 7,
  limit = 10,
): Promise<string[]> {
  const since = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from("invoices")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("supplier_name", null)
    .not("file_path", "is", null)
    .eq("needs_review", true)
    .neq("status", "rejected")
    .neq("status", "duplicate")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? []).map((r) => r.id)
}
