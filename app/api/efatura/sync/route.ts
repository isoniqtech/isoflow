import { NextResponse } from "next/server"
import { z } from "zod"

const bodySchema = z.object({
  tenant_id:   z.string().uuid(),
  "Data":      z.string().optional().nullable(),       // YYYY-MM-DD
  "Fornecedor": z.string().optional().nullable(),
  "e-Fatura":  z.string(),                             // número único do doc AT
  "Total":     z.coerce.number().optional().nullable(),
  "Estado AT": z.string().optional().nullable(),       // "Pendente" | "Associada" | ...
})

export async function POST(request: Request) {
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

  const { tenant_id } = parsed.data
  const docNumber = parsed.data["e-Fatura"]
  const supplierName = parsed.data["Fornecedor"] ?? null
  const docDate = parsed.data["Data"] ?? null
  const total = parsed.data["Total"] ?? null
  const atStatus = parsed.data["Estado AT"] ?? null

  const { createServiceClient } = await import("@/lib/supabase/server")
  const supabase = createServiceClient()

  const { error } = await supabase
    .from("efatura_documents")
    .upsert(
      {
        tenant_id,
        toconline_id:    docNumber,
        document_number: docNumber,
        document_date:   docDate,
        supplier_name:   supplierName,
        total,
        currency:        "EUR",
        at_status:       atStatus,
        raw_data:        {},
        updated_at:      new Date().toISOString(),
      },
      { onConflict: "tenant_id,toconline_id", ignoreDuplicates: false },
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
