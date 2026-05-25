import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { listInvoices, type InvoiceListItem } from "@/lib/queries/invoices"
import { buildCsv, csvResponse, safeFilename } from "@/lib/export/csv"
import type { InvoiceSource, InvoiceStatus } from "@/types"

const VALID_STATUS: Array<InvoiceStatus | "all"> = [
  "all",
  "pending",
  "processing",
  "matched",
  "paid",
  "rejected",
  "duplicate",
]
const VALID_SOURCE: Array<InvoiceSource | "all"> = [
  "all",
  "manual",
  "whatsapp",
  "email",
  "api",
  "erp",
]

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: "Pendente",
  processing: "A processar",
  matched: "Conciliada",
  paid: "Paga",
  rejected: "Rejeitada",
  duplicate: "Duplicada",
  reconciled: "Conciliada AT",
}

const SOURCE_LABELS: Record<InvoiceSource, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  manual: "Manual",
  api: "API",
  erp: "ERP",
}

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "relatorios", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  const { searchParams } = new URL(req.url)
  const status = (VALID_STATUS as string[]).includes(searchParams.get("status") ?? "")
    ? (searchParams.get("status") as InvoiceStatus | "all")
    : "all"
  const source = (VALID_SOURCE as string[]).includes(searchParams.get("source") ?? "")
    ? (searchParams.get("source") as InvoiceSource | "all")
    : "all"
  const project_id = searchParams.get("project") ?? "all"
  const needs_review = searchParams.get("review") === "1"
  const date_from = searchParams.get("from") ?? ""
  const date_to = searchParams.get("to") ?? ""

  const filter = {
    status,
    source,
    project_id,
    needs_review,
    date_from: date_from || undefined,
    date_to: date_to || undefined,
  }

  const all: InvoiceListItem[] = []
  let pageNum = 1
  while (true) {
    const result = await listInvoices(ctx.tenantId, {
      role: ctx.role,
      userId: ctx.userId,
      filter,
      page: pageNum,
    })
    all.push(...result.invoices)
    if (all.length >= result.total || result.invoices.length === 0) break
    pageNum += 1
    if (pageNum > 100) break // safety cap a 5000 linhas
  }

  const csv = buildCsv(all, [
    { header: "Fornecedor", value: (r) => r.supplier_name },
    { header: "NIF", value: (r) => r.supplier_nif },
    { header: "Numero", value: (r) => r.invoice_number },
    { header: "Data", value: (r) => r.invoice_date },
    { header: "Vencimento", value: (r) => r.due_date },
    { header: "Total", value: (r) => (r.total !== null ? r.total.toFixed(2) : "") },
    { header: "Moeda", value: (r) => r.currency },
    { header: "Categoria", value: (r) => r.category },
    { header: "Estado", value: (r) => STATUS_LABELS[r.status] },
    { header: "Origem", value: (r) => SOURCE_LABELS[r.source] },
    { header: "Projeto", value: (r) => r.project?.name ?? "" },
    { header: "Necessita revisao", value: (r) => (r.needs_review ? "Sim" : "Nao") },
    { header: "Criado em", value: (r) => r.created_at },
  ])

  return csvResponse(csv, safeFilename("faturas", "csv"))
}
