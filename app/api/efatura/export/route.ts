import * as XLSX from "xlsx"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { buildCsv, csvResponse, safeFilename } from "@/lib/export/csv"
import { EFaturaExportReport } from "@/lib/pdf/efatura-report"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const AT_STATUS_LABELS: Record<string, string> = {
  Pendente: "Pendente",
  Associada: "Compra Registada",
  compra_registada: "Compra Registada",
  doc_contabilidade: "Doc. Contabilidade",
  nao_considerado: "Não Considerado",
}

const COLUMNS = [
  { header: "Fornecedor",    value: (r: Record<string, unknown>) => r.supplier_name as string },
  { header: "NIF",           value: (r: Record<string, unknown>) => r.supplier_nif as string },
  { header: "Nº Documento",  value: (r: Record<string, unknown>) => r.document_number as string },
  { header: "Data",          value: (r: Record<string, unknown>) => r.document_date as string },
  { header: "Total",         value: (r: Record<string, unknown>) => r.total !== null ? Number(r.total).toFixed(2) : "" },
  { header: "Estado AT",     value: (r: Record<string, unknown>) => AT_STATUS_LABELS[r.at_status as string] ?? (r.at_status as string) ?? "" },
]

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "relatorios", "view_all")) return jsonError("Forbidden", 403)

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") ?? "csv"
  const atStatusParam = searchParams.get("at_status") ?? ""
  const atStatuses = atStatusParam ? atStatusParam.split(",").filter(Boolean) : []

  let query = createClient()
    .from("efatura_documents")
    .select("supplier_name, supplier_nif, document_number, document_date, total, at_status")
    .eq("tenant_id", ctx.tenantId)
    .order("document_date", { ascending: false })
    .limit(2000)

  if (atStatuses.length > 0) {
    query = query.in("at_status", atStatuses)
  }

  const { data: docs } = await query
  const rows = (docs ?? []) as Record<string, unknown>[]

  if (format === "xlsx") {
    const sheetRows = rows.map(r => Object.fromEntries(COLUMNS.map(c => [c.header, c.value(r) ?? ""])))
    const ws = XLSX.utils.json_to_sheet(sheetRows, { header: COLUMNS.map(c => c.header) })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "e-Fatura")
    const raw = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array
    return new Response(Buffer.from(raw), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFilename("efatura", "xlsx")}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  if (format === "pdf") {
    const supabase = createClient()
    const { data: tenant } = await supabase.from("tenants").select("name, app_name").eq("id", ctx.tenantId).maybeSingle()
    const tenantName = tenant?.app_name ?? tenant?.name ?? "ISOFlow"
    const generatedAt = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date())

    const element = createElement(EFaturaExportReport, {
      docs: rows,
      tenantName,
      generatedAt,
      filters: atStatuses.length ? atStatuses.map(s => AT_STATUS_LABELS[s] ?? s).join(", ") : undefined,
    }) as unknown as Parameters<typeof renderToBuffer>[0]

    const pdfBytes = new Uint8Array(await renderToBuffer(element))
    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename("efatura", "pdf")}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const csv = buildCsv(rows, COLUMNS)
  return csvResponse(csv, safeFilename("efatura", "csv"))
}
