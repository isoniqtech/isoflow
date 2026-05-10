import { createClient } from "@/lib/supabase/server"
import type {
  InvoiceSource,
  InvoiceStatus,
  ProjectType,
  ProjectStatus,
  UserRole,
} from "@/types"

export type InvoiceListItem = {
  id: string
  supplier_name: string | null
  supplier_nif: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  total: number | null
  currency: string
  status: InvoiceStatus
  source: InvoiceSource
  category: string | null
  needs_review: boolean
  project: { id: string; name: string; color: string } | null
  created_at: string
}

export type InvoicesFilter = {
  status?: InvoiceStatus | "all"
  source?: InvoiceSource | "all"
  project_id?: string | "all" | "none"
  category?: string | "all"
  needs_review?: boolean
  date_from?: string
  date_to?: string
}

export type InvoicesListResult = {
  invoices: InvoiceListItem[]
  total: number
  page: number
  page_size: number
}

export type ProjectOption = {
  id: string
  name: string
  color: string
  type: ProjectType
  status: ProjectStatus
}

const PAGE_SIZE = 50

export async function listInvoices(
  tenantId: string,
  options: {
    role: UserRole
    userId: string
    filter?: InvoicesFilter
    page?: number
  },
): Promise<InvoicesListResult> {
  const supabase = createClient()
  const { role, userId, filter, page = 1 } = options
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from("invoices")
    .select(
      "id, supplier_name, supplier_nif, invoice_number, invoice_date, due_date, total, currency, status, source, category, needs_review, project_id, created_at",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)

  if (role === "member") {
    query = query.eq("created_by", userId)
  }

  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status)
  }
  if (filter?.source && filter.source !== "all") {
    query = query.eq("source", filter.source)
  }
  if (filter?.project_id) {
    if (filter.project_id === "none") {
      query = query.is("project_id", null)
    } else if (filter.project_id !== "all") {
      query = query.eq("project_id", filter.project_id)
    }
  }
  if (filter?.category && filter.category !== "all") {
    query = query.eq("category", filter.category)
  }
  if (filter?.needs_review) {
    query = query.eq("needs_review", true)
  }
  if (filter?.date_from) {
    query = query.gte("invoice_date", filter.date_from)
  }
  if (filter?.date_to) {
    query = query.lte("invoice_date", filter.date_to)
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const rows = data ?? []
  const projectIds = Array.from(
    new Set(rows.map((r) => r.project_id).filter((p): p is string => Boolean(p))),
  )

  let projectMap = new Map<string, { id: string; name: string; color: string }>()
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, color")
      .in("id", projectIds)
    for (const p of projects ?? []) {
      projectMap.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color ?? "#2563EB",
      })
    }
  }

  const invoices: InvoiceListItem[] = rows.map((r) => ({
    id: r.id,
    supplier_name: r.supplier_name,
    supplier_nif: r.supplier_nif,
    invoice_number: r.invoice_number,
    invoice_date: r.invoice_date,
    due_date: r.due_date,
    total: r.total !== null ? Number(r.total) : null,
    currency: r.currency ?? "EUR",
    status: (r.status ?? "pending") as InvoiceStatus,
    source: (r.source ?? "manual") as InvoiceSource,
    category: r.category,
    needs_review: r.needs_review ?? false,
    project: r.project_id ? projectMap.get(r.project_id) ?? null : null,
    created_at: r.created_at ?? new Date().toISOString(),
  }))

  return {
    invoices,
    total: count ?? 0,
    page,
    page_size: PAGE_SIZE,
  }
}

export async function listProjectOptions(
  tenantId: string,
): Promise<ProjectOption[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("projects")
    .select("id, name, color, type, status")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color ?? "#2563EB",
    type: (p.type ?? "obra") as ProjectType,
    status: (p.status ?? "active") as ProjectStatus,
  }))
}
