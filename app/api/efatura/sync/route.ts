import { NextResponse } from "next/server"
import { z } from "zod"

// Cada documento e-Fatura que o Toconline envia
const documentSchema = z.object({
  toconline_id:    z.string(),
  at_document_id:  z.string().optional().nullable(),
  document_number: z.string().optional().nullable(),
  document_date:   z.string().optional().nullable(),   // YYYY-MM-DD
  supplier_nif:    z.string().optional().nullable(),
  supplier_name:   z.string().optional().nullable(),
  total:           z.number().optional().nullable(),
  subtotal:        z.number().optional().nullable(),
  vat_amount:      z.number().optional().nullable(),
  currency:        z.string().optional().nullable(),
  at_status:       z.string().optional().nullable(),   // "compra_registada" | "nao_considerado" | "doc_contabilidade" | "sem_associacao"
  raw_data:        z.record(z.string(), z.unknown()).optional(),
})

const bodySchema = z.object({
  tenant_id: z.string().uuid(),
  documents: z.array(documentSchema).min(1).max(500),
})

export async function POST(request: Request) {
  // Validar secret (mesmo mecanismo do webhook de receita)
  const secret = request.headers.get("x-isoflow-secret")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { tenant_id, documents } = parsed.data
  const { createServiceClient } = await import("@/lib/supabase/server")
  const supabase = createServiceClient()

  // Buscar faturas do tenant para auto-match (por nº fatura + NIF fornecedor)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, supplier_nif, toconline_fc_id")
    .eq("tenant_id", tenant_id)
    .not("toconline_fc_id", "is", null)

  const invoiceMap = new Map<string, string>() // "nif:numero" → invoice_id
  for (const inv of invoices ?? []) {
    if (inv.invoice_number) {
      const key = `${inv.supplier_nif ?? ""}:${inv.invoice_number}`
      invoiceMap.set(key, inv.id)
    }
  }

  let upserted = 0
  let matched = 0
  const errors: string[] = []

  for (const doc of documents) {
    try {
      // Tentar auto-match
      const key = `${doc.supplier_nif ?? ""}:${doc.document_number ?? ""}`
      const matched_invoice_id = doc.document_number ? (invoiceMap.get(key) ?? null) : null

      const { error } = await supabase
        .from("efatura_documents")
        .upsert(
          {
            tenant_id,
            toconline_id:    doc.toconline_id,
            at_document_id:  doc.at_document_id ?? null,
            document_number: doc.document_number ?? null,
            document_date:   doc.document_date ?? null,
            supplier_nif:    doc.supplier_nif ?? null,
            supplier_name:   doc.supplier_name ?? null,
            total:           doc.total ?? null,
            subtotal:        doc.subtotal ?? null,
            vat_amount:      doc.vat_amount ?? null,
            currency:        doc.currency ?? "EUR",
            at_status:       doc.at_status ?? "sem_associacao",
            invoice_id:      matched_invoice_id,
            matched_at:      matched_invoice_id ? new Date().toISOString() : null,
            matched_by:      matched_invoice_id ? "auto" : null,
            raw_data:        doc.raw_data ?? {},
            updated_at:      new Date().toISOString(),
          },
          { onConflict: "tenant_id,toconline_id", ignoreDuplicates: false },
        )

      if (error) {
        errors.push(`${doc.toconline_id}: ${error.message}`)
      } else {
        upserted++
        if (matched_invoice_id) matched++
      }
    } catch (err) {
      errors.push(`${doc.toconline_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ upserted, matched, errors })
}
