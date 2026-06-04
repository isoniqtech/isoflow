import * as XLSX from "xlsx"
import { renderToBuffer } from "@react-pdf/renderer"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { listInvoices, type InvoiceListItem } from "@/lib/queries/invoices"
import { buildCsv, csvResponse, safeFilename } from "@/lib/export/csv"
import { FaturasReport } from "@/lib/pdf/faturas-report"
import { createClient } from "@/lib/supabase/server"
import type { InvoiceSource, InvoiceStatus } from "@/types"
import { createElement } from "react"

export const runtime = "nodejs"

const VALID_STATUS: Array<InvoiceStatus | "all"> = [
  "all", "em_sistema", "necessita_revisao", "enviada_erp",
  "pending", "processing", "matched", "paid", "rejected", "duplicate", "reconciled",
]
const VALID_SOURCE: Array<InvoiceSource | "all"> = [
  "all", "manual", "whatsapp", "email", "api", "erp",
]

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  em_sistema: "Em Sistema",
  necessita_revisao: "Necessita Revisão",
  enviada_erp: "Enviada ERP",
  rejected: "Rejeitada",
  duplicate: "Duplicada",
  pending: "Em Sistema",
  processing: "Em Sistema",
  matched: "Em Sistema",
  paid: "Em Sistema",
  reconciled: "Em Sistema",
}

const SOURCE_LABELS: Record<InvoiceSource, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  manual: "Manual",
  api: "API",
  erp: "ERP",
}

const COLUMNS = [
  { header: "Fornecedor",       value: (r: InvoiceListItem) => r.supplier_name },
  { header: "NIF",              value: (r: InvoiceListItem) => r.supplier_nif },
  { header: "Numero",           value: (r: InvoiceListItem) => r.invoice_number },
  { header: "Data",             value: (r: InvoiceListItem) => r.invoice_date },
  { header: "Vencimento",       value: (r: InvoiceListItem) => r.due_date },
  { header: "Total",            value: (r: InvoiceListItem) => r.total !== null ? r.total.toFixed(2) : "" },
  { header: "Moeda",            value: (r: InvoiceListItem) => r.currency },
  { header: "Categoria",        value: (r: InvoiceListItem) => r.category },
  { header: "Estado",           value: (r: InvoiceListItem) => STATUS_LABELS[r.status] },
  { header: "Origem",           value: (r: InvoiceListItem) => SOURCE_LABELS[r.source] },
  { header: "Projeto",          value: (r: InvoiceListItem) => r.project?.name ?? "" },
  { header: "Necessita revisao",value: (r: InvoiceListItem) => r.needs_review ? "Sim" : "Nao" },
  { header: "Criado em",        value: (r: InvoiceListItem) => r.created_at },
]

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "relatorios", "view_all")) return jsonError("Forbidden", 403)

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") ?? "csv"
  const status = (VALID_STATUS as string[]).includes(searchParams.get("status") ?? "")
    ? (searchParams.get("status") as InvoiceStatus | "all") : "all"
  const source = (VALID_SOURCE as string[]).includes(searchParams.get("source") ?? "")
    ? (searchParams.get("source") as InvoiceSource | "all") : "all"
  const project_id = searchParams.get("project") ?? "all"
  const needs_review = searchParams.get("review") === "1"
  const date_from = searchParams.get("from") ?? ""
  const date_to = searchParams.get("to") ?? ""

  const filter = { status, source, project_id, needs_review,
    date_from: date_from || undefined, date_to: date_to || undefined }

  // Paginar até ao fim
  const all: InvoiceListItem[] = []
  let pageNum = 1
  while (true) {
    const result = await listInvoices(ctx.tenantId, { role: ctx.role, userId: ctx.userId, filter, page: pageNum })
    all.push(...result.invoices)
    if (all.length >= result.total || result.invoices.length === 0) break
    pageNum += 1
    if (pageNum > 100) break
  }

  if (format === "xlsx") {
    const rows = all.map((r) =>
      Object.fromEntries(COLUMNS.map((c) => [c.header, c.value(r) ?? ""]))
    )
    const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS.map((c) => c.header) })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Faturas")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFilename("faturas", "xlsx")}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  if (format === "pdf") {
    const supabase = createClient()
    const { data: tenant } = await supabase
      .from("tenants").select("name, app_name").eq("id", ctx.tenantId).maybeSingle()
    const tenantName = tenant?.app_name ?? tenant?.name ?? "ISOFlow"
    const generatedAt = new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "short", timeStyle: "short",
    }).format(new Date())
    const filterParts: string[] = []
    if (status !== "all") filterParts.push(`Estado: ${STATUS_LABELS[status as InvoiceStatus] ?? status}`)
    if (source !== "all") filterParts.push(`Origem: ${SOURCE_LABELS[source as InvoiceSource] ?? source}`)
    if (date_from) filterParts.push(`De: ${date_from}`)
    if (date_to) filterParts.push(`Até: ${date_to}`)

    const buf = await renderToBuffer(
      createElement(FaturasReport, {
        invoices: all,
        tenantName,
        generatedAt,
        filters: filterParts.length ? filterParts.join(" · ") : undefined,
      })
    )
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename("faturas", "pdf")}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  // Default: CSV
  const csv = buildCsv(all, COLUMNS)
  return csvResponse(csv, safeFilename("faturas", "csv"))
}
