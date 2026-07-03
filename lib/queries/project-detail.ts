import { createClient } from "@/lib/supabase/server"
import type {
  Invoice,
  InvoiceStatus,
  InvoiceSource,
  ProjectStatus,
  ProjectType,
  VatRegime,
} from "@/types"

export type ProjectDetail = {
  id: string
  name: string
  code: string | null
  description: string | null
  type: ProjectType
  status: ProjectStatus
  color: string
  client_name: string | null
  location: string | null
  notes: string | null
  budget: number | null
  budget_alert_threshold: number
  start_date: string | null
  end_date: string | null
  name_aliases: string[]
  created_at: string
}

export type ProjectKpis = {
  total_spent: number
  invoice_count: number
  budget_remaining: number | null
  pct_used: number | null
}

export type ProjectInvoiceRow = {
  id: string
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number | null
  status: InvoiceStatus
  source: InvoiceSource
  category: string | null
}

export type ProjectChartPoint = { month: string; value: number; count: number }
export type CategorySlice = { category: string; value: number }

export type ProjectDetailData = {
  project: ProjectDetail
  kpis: ProjectKpis
  monthly: ProjectChartPoint[]
  by_category: CategorySlice[]
  invoices: ProjectInvoiceRow[]
}

const PT_MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const

export async function getProjectDetail(
  id: string,
  tenantId: string,
  vatRegime: VatRegime = "normal",
): Promise<ProjectDetailData | null> {
  const supabase = createClient()

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  if (!project) return null

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select(
      "id, supplier_name, invoice_number, invoice_date, total, subtotal, status, source, category",
    )
    .eq("tenant_id", tenantId)
    .eq("project_id", id)
    .neq("status", "rejected")
    .order("created_at", { ascending: false })

  const invoices: ProjectInvoiceRow[] = (invoiceRows ?? []).map((r) => ({
    id: r.id,
    supplier_name: r.supplier_name,
    invoice_number: r.invoice_number,
    invoice_date: r.invoice_date,
    total: r.total !== null ? Number(r.total) : null,
    status: (r.status ?? "pending") as InvoiceStatus,
    source: (r.source ?? "manual") as InvoiceSource,
    category: r.category,
  }))

  const total_spent = (invoiceRows ?? []).reduce((s, r) => {
    const amount = vatRegime === "isento"
      ? Number(r.subtotal ?? r.total ?? 0)
      : Number(r.total ?? 0)
    return s + amount
  }, 0)
  const budget = project.budget !== null ? Number(project.budget) : null
  const kpis: ProjectKpis = {
    total_spent,
    invoice_count: invoices.length,
    budget_remaining: budget !== null ? budget - total_spent : null,
    pct_used: budget && budget > 0 ? (total_spent / budget) * 100 : null,
  }

  const monthly = buildMonthly(invoiceRows ?? [])
  const by_category = buildByCategory(invoices)

  return {
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      description: project.description,
      type: (project.type ?? "obra") as ProjectType,
      status: (project.status ?? "active") as ProjectStatus,
      color: project.color ?? "#2563EB",
      client_name: project.client_name,
      location: project.location,
      notes: project.notes,
      budget,
      budget_alert_threshold: project.budget_alert_threshold ?? 80,
      start_date: project.start_date,
      end_date: project.end_date,
      name_aliases: project.name_aliases ?? [],
      created_at: project.created_at ?? new Date().toISOString(),
    },
    kpis,
    monthly,
    by_category,
    invoices,
  }
}

function buildMonthly(
  rows: Array<{ invoice_date: string | null; total: number | null; subtotal: number | null }>,
): ProjectChartPoint[] {
  const now = new Date()
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // Find the earliest invoice_date in the project
  let earliestKey = nowKey
  for (const row of rows) {
    if (!row.invoice_date) continue
    const key = row.invoice_date.slice(0, 7) // "YYYY-MM"
    if (key < earliestKey) earliestKey = key
  }

  // Build window: from earliestKey to today, capped at 24 months
  const [ey, em] = earliestKey.split("-").map(Number)
  const [ny, nm] = nowKey.split("-").map(Number)
  const totalMonths = (ny - ey) * 12 + (nm - em) + 1
  const windowMonths = Math.min(totalMonths, 24)

  // Start from enough months back
  const buckets = new Map<string, { count: number; value: number }>()
  for (let i = windowMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    buckets.set(key, { count: 0, value: 0 })
  }
  // Make sure the earliest month is in the buckets even if > 24 months ago
  if (!buckets.has(earliestKey)) {
    // Rebuild from the actual earliest date
    const allKeys = new Set<string>()
    for (const row of rows) {
      if (row.invoice_date) allKeys.add(row.invoice_date.slice(0, 7))
    }
    for (const key of allKeys) {
      if (!buckets.has(key)) buckets.set(key, { count: 0, value: 0 })
    }
  }

  for (const row of rows) {
    if (!row.invoice_date) continue
    const key = row.invoice_date.slice(0, 7)
    const b = buckets.get(key)
    if (!b) continue
    b.count += 1
    b.value += Number(row.total ?? 0)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const monthIdx = parseInt(key.split("-")[1], 10) - 1
      return {
        month: PT_MONTHS[monthIdx] ?? key,
        count: v.count,
        value: v.value,
      }
    })
}

function buildByCategory(invoices: ProjectInvoiceRow[]): CategorySlice[] {
  const byCat = new Map<string, number>()
  for (const inv of invoices) {
    const cat = inv.category ?? "Sem categoria"
    byCat.set(cat, (byCat.get(cat) ?? 0) + Number(inv.total ?? 0))
  }
  return Array.from(byCat.entries())
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value)
}

// Helper para tipos Invoice se necessário em consumidores
export type { Invoice }
