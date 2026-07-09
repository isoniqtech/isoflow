import { NextResponse } from "next/server"
import { getApiContext } from "@/lib/api/auth"
import {
  extractInvoiceData,
  resolveAnthropicConfig,
  type InvoiceFileType,
} from "@/lib/claude/extract-invoice"

const ALLOWED_TYPES: Record<string, InvoiceFileType> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  const file = formData?.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Ficheiro em falta" }, { status: 400 })

  const fileType = ALLOWED_TYPES[file.type]
  if (!fileType) {
    return NextResponse.json(
      { error: "Tipo não suportado. Usa PDF, JPG ou PNG." },
      { status: 400 },
    )
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Ficheiro demasiado grande (máx 20MB)" }, { status: 400 })
  }

  const { createServiceClient } = await import("@/lib/supabase/server")
  const supabase = createServiceClient()
  const bucket = process.env.INVOICE_FILES_BUCKET ?? "invoice-files"
  const ext = file.name.split(".").pop() ?? fileType
  const filePath = `${ctx.tenantId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Erro no upload: ${uploadError.message}` }, { status: 500 })
  }

  const fileBase64 = buffer.toString("base64")
  try {
    const aiConfig = await resolveAnthropicConfig(ctx.tenantId, supabase)
    const extraction = await extractInvoiceData(fileBase64, fileType, aiConfig)

    return NextResponse.json({ extraction, file_path: filePath, file_name: file.name, file_type: fileType })
  } catch (err) {
    return NextResponse.json({
      extraction: null,
      file_path: filePath,
      file_name: file.name,
      file_type: fileType,
      ai_error: err instanceof Error ? err.message : "Extração IA falhou",
    })
  }
}
