import { createClient } from "@/lib/supabase/server"
import type { InvoiceStatus, InvoiceSource } from "@/types"

export type DashboardKpis = {
  invoices_this_month: number
  pending_count: number
  matched_count: number
  matched_pct: number
  revenue_this_month: number
  expenses_this_month: number
  net_this_month: number
  revenue_source: "toconline" | "invoices"
}

export type RecentInvoice = {
  id: string
  supplier_name: string | null
  invoice_number: string | null
  total: number | null
  status: InvoiceStatus
  source: InvoiceSource
  invoice_date: string | null
  created_at: string
}

export type RecentProject = {
  id: string
  name: string
  type: string
  status: string
  color: string
  budget: number | null
  budget_alert_threshold: number
  total_spent: number
  invoice_count: number
}

export type DashboardAlert = {
  id: string
  level: "warn" | "danger"
  title: string
  description: string
  href?: string
}

export type ChartPoint = {
  month: string
  count: number
  value: number
  revenue: number
  expenses: number
}

export type DashboardData = {
  year: number
  kpis: DashboardKpis
  chart: ChartPoint[]
  recent_invoices: RecentInvoice[]
  active_projects: RecentProject[]
  alerts: DashboardAlert[]
}

const PT_MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
] as const

const PLAN_QUOTA: Record<string, number> = {
  starter: 500,
  business: 1500,
  pro: 5000,
  enterprise: 10000,
}

export async function getDashboardData(
  tenantId: string,
  options: { creditsBalance: number; plan: string },
): Promise<DashboardData> {
  const supabase = createClient()

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const startOfMonth = new Date(currentYear, now.getMonth(), 1)

  const [
    { data: monthInvoices },
    { data: recentInvoicesData },
    { data: projectsData },
    { data: tenantCache },
    { count: pendingCount },
    { data: annualRows },
    { data: snapshotRows },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, total, status, invoice_date, created_at, type")
      .eq("tenant_id", tenantId)
      .gte("created_at", startOfMonth.toISOString())
      .neq("status", "rejected"),
    supabase
      .from("invoices")
      .select("id, supplier_name, invoice_number, total, status, source, invoice_date, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("projects")
      .select("id, name, type, status, color, budget, budget_alert_threshold, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("tenants")
      .select("toconline_revenue_total, toconline_revenue_month, toconline_revenue_year")
      .eq("id", tenantId)
      .single(),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "processing"]),
    supabase
      .from("invoices")
      .select("invoice_date, total, type")
      .eq("tenant_id", tenantId)
      .gte("invoice_date", `${currentYear}-01-01`)
      .lte("invoice_date", `${currentYear}-12-31`)
      .neq("status", "rejected"),
    supabase
      .from("monthly_snapshots")
      .select("month, revenue")
      .eq("tenant_id", tenantId)
      .eq("year", currentYear),
  ])

  const monthList = monthInvoices ?? []
  const invoicesThisMonth = monthList.length
  const matched = monthList.filter(
    (i) => i.status === "matched" || i.status === "paid",
  ).length
  const matchedPct =
    invoicesThisMonth > 0 ? Math.round((matched / invoicesThisMonth) * 100) : 0

  const expensesThisMonth = monthList
    .filter((i) => i.type === "incoming")
    .reduce((s, i) => s + Number(i.total ?? 0), 0)

  const cachedRevenue = tenantCache
  const useToconlineCache =
    cachedRevenue &&
    cachedRevenue.toconline_revenue_month === currentMonth &&
    cachedRevenue.toconline_revenue_year === currentYear &&
    cachedRevenue.toconline_revenue_total !== null
  const revenueThisMonth = useToconlineCache
    ? Number(cachedRevenue!.toconline_revenue_total)
    : monthList
        .filter((i) => i.type === "outgoing")
        .reduce((s, i) => s + Number(i.total ?? 0), 0)

  const kpis: DashboardKpis = {
    invoices_this_month: invoicesThisMonth,
    pending_count: pendingCount ?? 0,
    matched_count: matched,
    matched_pct: matchedPct,
    revenue_this_month: revenueThisMonth,
    expenses_this_month: expensesThisMonth,
    net_this_month: revenueThisMonth - expensesThisMonth,
    revenue_source: useToconlineCache ? "toconline" : "invoices",
  }

  const snapshotMap = new Map<number, number>(
    (snapshotRows ?? []).map((s) => [s.month, Number(s.revenue)]),
  )

  const chart = buildAnnualChart(
    currentMonth,
    annualRows ?? [],
    snapshotMap,
    revenueThisMonth,
  )

  const recent_invoices: RecentInvoice[] = (recentInvoicesData ?? []).map((row) => ({
    id: row.id,
    supplier_name: row.supplier_name,
    invoice_number: row.invoice_number,
    total: row.total !== null ? Number(row.total) : null,
    status: (row.status ?? "pending") as InvoiceStatus,
    source: (row.source ?? "manual") as InvoiceSource,
    invoice_date: row.invoice_date,
    created_at: row.created_at ?? new Date().toISOString(),
  }))

  const projects = projectsData ?? []
  const projectIds = projects.map((p) => p.id)
  const projectInvoiceTotals = new Map<string, { spent: number; count: number }>()

  if (projectIds.length) {
    const { data: projInvoices } = await supabase
      .from("invoices")
      .select("project_id, total")
      .eq("tenant_id", tenantId)
      .in("project_id", projectIds)
      .neq("status", "rejected")

    for (const row of projInvoices ?? []) {
      if (!row.project_id) continue
      const current = projectInvoiceTotals.get(row.project_id) ?? { spent: 0, count: 0 }
      current.spent += Number(row.total ?? 0)
      current.count += 1
      projectInvoiceTotals.set(row.project_id, current)
    }
  }

  const active_projects: RecentProject[] = projects.map((p) => {
    const totals = projectInvoiceTotals.get(p.id) ?? { spent: 0, count: 0 }
    return {
      id: p.id,
      name: p.name,
      type: p.type ?? "obra",
      status: p.status ?? "active",
      color: p.color ?? "#2563EB",
      budget: p.budget !== null ? Number(p.budget) : null,
      budget_alert_threshold: p.budget_alert_threshold ?? 80,
      total_spent: totals.spent,
      invoice_count: totals.count,
    }
  })

  const alerts = buildAlerts({
    creditsBalance: options.creditsBalance,
    plan: options.plan,
    activeProjects: active_projects,
    recentInvoices: recent_invoices,
  })

  return { year: currentYear, kpis, chart, recent_invoices, active_projects, alerts }
}

function buildAnnualChart(
  currentMonth: number,
  invoiceRows: Array<{ invoice_date: string | null; total: number | null; type: string | null }>,
  snapshotRevenue: Map<number, number>,
  currentMonthRevenue: number,
): ChartPoint[] {
  const result: ChartPoint[] = Array.from({ length: 12 }, (_, i) => ({
    month: PT_MONTHS[i],
    count: 0,
    value: 0,
    revenue: 0,
    expenses: 0,
  }))

  for (let m = 1; m <= 12; m++) {
    if (m < currentMonth) {
      result[m - 1].revenue = snapshotRevenue.get(m) ?? 0
    } else if (m === currentMonth) {
      result[m - 1].revenue = currentMonthRevenue
    }
  }

  for (const row of invoiceRows) {
    if (!row.invoice_date) continue
    const m = parseInt(row.invoice_date.slice(5, 7), 10)
    if (m < 1 || m > 12) continue
    const amount = Number(row.total ?? 0)
    if (row.type === "incoming") {
      result[m - 1].expenses += amount
    }
    result[m - 1].count += 1
    result[m - 1].value += amount
  }

  return result
}

function buildAlerts(input: {
  creditsBalance: number
  plan: string
  activeProjects: RecentProject[]
  recentInvoices: RecentInvoice[]
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdue = input.recentInvoices.filter(
    (i) =>
      i.status !== "paid" &&
      i.status !== "rejected" &&
      i.invoice_date &&
      new Date(i.invoice_date) < today,
  )
  if (overdue.length > 0) {
    alerts.push({
      id: "overdue",
      level: "danger",
      title: `${overdue.length} fatura(s) vencida(s)`,
      description: "Algumas faturas têm data de vencimento ultrapassada.",
      href: "/faturas?status=pending",
    })
  }

  for (const project of input.activeProjects) {
    if (!project.budget) continue
    const pct = (project.total_spent / project.budget) * 100
    if (pct >= project.budget_alert_threshold) {
      alerts.push({
        id: `budget-${project.id}`,
        level: pct >= 100 ? "danger" : "warn",
        title: `${project.name}: ${Math.round(pct)}% do orçamento`,
        description:
          pct >= 100
            ? "Orçamento ultrapassado."
            : `Acima do limite de aviso (${project.budget_alert_threshold}%).`,
        href: `/projetos/${project.id}`,
      })
    }
  }

  const quota = PLAN_QUOTA[input.plan] ?? 0
  if (quota > 0) {
    const pct = (input.creditsBalance / quota) * 100
    if (pct < 30) {
      alerts.push({
        id: "low-credits",
        level: pct < 10 ? "danger" : "warn",
        title: `Créditos baixos (${Math.round(pct)}%)`,
        description: `Restam ${input.creditsBalance.toLocaleString("pt-PT")} créditos.`,
        href: "/configuracoes/plano",
      })
    }
  }

  return alerts
}
