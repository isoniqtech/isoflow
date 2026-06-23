import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { extractInvoiceData } from "@/lib/claude/extract-invoice"
import type { InvoiceFileType } from "@/lib/claude/extract-invoice"
import { log } from "@/lib/utils/audit"

const BUCKET = process.env.INVOICE_FILES_BUCKET ?? "invoice-files"

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const admin = createAdminClient()

  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, file_path, file_type, source, tenant_id")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()

  if (fetchErr) return jsonError("Database error", 500, fetchErr.message)
  if (!invoice) return jsonError("Not found", 404)
  if (!invoice.file_path) return jsonError("Sem ficheiro para reprocessar", 400)

  const fileType = (invoice.file_type ?? "pdf") as InvoiceFileType

  // Download do ficheiro do Storage
  const { data: fileData, error: dlErr } = await admin.storage
    .from(BUCKET)
    .download(invoice.file_path)

  if (dlErr || !fileData) {
    return jsonError("Erro ao ler ficheiro do Storage", 500, dlErr?.message)
  }

  const arrayBuf = await fileData.arrayBuffer()
  const fileBase64 = Buffer.from(arrayBuf).toString("base64")

  // Re-extrair com Claude (inclui retry automatico para 429/503/529)
  let extraction
  try {
    extraction = await extractInvoiceData(fileBase64, fileType)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonError(`Extração AI falhou: ${msg}`, 502)
  }

  // Atualizar fatura com novos dados
  const { data: updated, error: updateErr } = await supabase
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
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .select("id, supplier_name, invoice_number, total, ai_confidence")
    .single()

  if (updateErr || !updated) {
    return jsonError("Erro ao guardar dados", 500, updateErr?.message)
  }

  await log(supabase, {
    action: "invoice.reprocessed",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "invoice",
    resourceId: params.id,
    metadata: { confidence: extraction.confidence },
  })

  return Response.json({ ok: true, invoice: updated })
}
