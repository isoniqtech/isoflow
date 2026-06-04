import { createClient } from "@/lib/supabase/server"
import type { VatRegime } from "@/types"

export type DashboardMode = "mensal" | "acumulado"

export type DashboardKpis = {
  invoices_this_period: number
  // Bank pending
  bank_pending_count: number
  bank_pending_pct: number
  bank_total_count: number
  // e-Fatura pending
  efatura_pending_count: number
  efatura_pending_pct: number
  efatura_total_count: number
  // Revenue / expenses (always without VAT = subtotal)
  revenue: number
  expenses: number
  ebitda: number
  ebitda_pct: number
  revenue_source: "toconline" | "invoices"
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
  remaining: number | null
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
  ebitda: number
}

export type DashboardData = {
  year: number
  month: number
  mode: DashboardMode
  kpis: DashboardKpis
  chart: ChartPoint[]
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
  options: {
    creditsBalance: number
    plan: string
    vatRegime: VatRegime
    mode: DashboardMode
    month: number
    year: number
  },
): Promise<DashboardData> {
  const supabase = createClient()

  const { mode, month, year, vatRegime } = options

  // Date range for the selected period
  let startDate: string
  let endDate: string
  if (mode === "mensal") {
    const lastDay = new Date(year, month, 0).getDate()
    startDate = `${year}-${String(month).padStart(2, "0")}-01`
    endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  } else {
    startDate = `${year}-01-01`
    endDate = `${year}-12-31`
  }

  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  const [
    { data: periodInvoices },
    { data: projectsData },
    { data: tenantCache },
    { data: annualRows },
    { data: snapshotRows },
    { data: bankAllData },
    { data: efaturaData },
  ] = await Promise.all([
    // Period invoices (for KPIs)
    supabase
      .from("invoices")
      .select("id, total, subtotal, status, invoice_date, created_at, type")
      .eq("tenant_id", tenantId)
      .gte("invoice_date", startDate)
      .lte("invoice_date", endDate)
      .neq("status", "rejected"),
    // Active projects
    supabase
      .from("projects")
      .select("id, name, type, status, color, budget, budget_alert_threshold, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6),
    // Toconline revenue cache
    supabase
      .from("tenants")
      .select("toconline_revenue_total, toconline_revenue_month, toconline_revenue_year")
      .eq("id", tenantId)
      .single(),
    // Annual rows for chart
    supabase
      .from("invoices")
      .select("invoice_date, total, subtotal, type")
      .eq("tenant_id", tenantId)
      .gte("invoice_date", `${year}-01-01`)
      .lte("invoice_date", `${year}-12-31`)
      .neq("status", "rejected"),
    // Monthly snapshots for past months
    supabase
      .from("monthly_snapshots")
      .select("month, revenue")
      .eq("tenant_id", tenantId)
      .eq("year", year),
    // Bank transactions do período: total e pendentes de conciliação
    supabase
      .from("bank_transactions")
      .select("id, invoice_id")
      .eq("tenant_id", tenantId)
      .gte("date", startDate)
      .lte("date", endDate),
    // e-Fatura docs: total and unmatched
    supabase
      .from("efatura_documents")
      .select("id, invoice_id")
      .eq("tenant_id", tenantId),
  ])

  const periodList = periodInvoices ?? []
  const invoicesThisPeriod = periodList.length

  // Expenses without VAT: use subtotal for incoming
  const expensesRaw = periodList
    .filter((i) => i.type === "incoming")
    .reduce((s, i) => s + Number(i.subtotal ?? i.total ?? 0), 0)

  // Revenue without VAT: try Toconline cache first (only for current month in mensal mode)
  const cachedRevenue = tenantCache
  const useToconlineCache =
    mode === "mensal" &&
    cachedRevenue &&
    cachedRevenue.toconline_revenue_month === month &&
    cachedRevenue.toconline_revenue_year === year &&
    cachedRevenue.toconline_revenue_total !== null
  const revenueRaw = useToconlineCache
    ? Number(cachedRevenue!.toconline_revenue_total)
    : periodList
        .filter((i) => i.type === "outgoing")
        .reduce((s, i) => s + Number(i.subtotal ?? i.total ?? 0), 0)

  const ebitda = revenueRaw - expensesRaw
  const ebitdaPct = revenueRaw > 0 ? Math.round((ebitda / revenueRaw) * 100) : 0

  // Bank pending: transações do período sem invoice_id (por conciliar)
  const bankAll = bankAllData ?? []
  const bankTotal = bankAll.length
  const bankPending = bankAll.filter((t) => !(t as { invoice_id?: string | null }).invoice_id).length
  const bankPendingPct = bankTotal > 0 ? Math.round((bankPending / bankTotal) * 100) : 0

  // e-Fatura pending (docs without invoice_id)
  const efaturaAll = efaturaData ?? []
  const efaturaTotal = efaturaAll.length
  const efaturaPending = efaturaAll.filter((d) => !d.invoice_id).length
  const efaturaPendingPct = efaturaTotal > 0 ? Math.round((efaturaPending / efaturaTotal) * 100) : 0

  const kpis: DashboardKpis = {
    invoices_this_period: invoicesThisPeriod,
    bank_pending_count: bankPending,
    bank_pending_pct: bankPendingPct,
    bank_total_count: bankTotal,
    efatura_pending_count: efaturaPending,
    efatura_pending_pct: efaturaPendingPct,
    efatura_total_count: efaturaTotal,
    revenue: revenueRaw,
    expenses: expensesRaw,
    ebitda,
    ebitda_pct: ebitdaPct,
    revenue_source: useToconlineCache ? "toconline" : "invoices",
  }

  // Chart: always annual, always without VAT
  const snapshotMap = new Map<number, number>(
    (snapshotRows ?? []).map((s) => [s.month, Number(s.revenue)]),
  )
  const chart = buildAnnualChart(
    currentMonth,
    currentYear,
    year,
    mode,
    month,
    annualRows ?? [],
    snapshotMap,
    revenueRaw,
  )

  // Projects with VAT-aware calculation
  const projects = projectsData ?? []
  const projectIds = projects.map((p) => p.id)
  const projectInvoiceTotals = new Map<string, { spent: number; count: number }>()

  if (projectIds.length) {
    const { data: projInvoices } = await supabase
      .from("invoices")
      .select("project_id, total, subtotal")
      .eq("tenant_id", tenantId)
      .in("project_id", projectIds)
      .neq("status", "rejected")

    for (const row of projInvoices ?? []) {
      if (!row.project_id) continue
      const current = projectInvoiceTotals.get(row.project_id) ?? { spent: 0, count: 0 }
      const amount = vatRegime === "isento"
        ? Number(row.subtotal ?? row.total ?? 0)
        : Number(row.total ?? 0)
      current.spent += amount
      current.count += 1
      projectInvoiceTotals.set(row.project_id, current)
    }
  }

  const active_projects: RecentProject[] = projects.map((p) => {
    const totals = projectInvoiceTotals.get(p.id) ?? { spent: 0, count: 0 }
    const budget = p.budget !== null ? Number(p.budget) : null
    return {
      id: p.id,
      name: p.name,
      type: p.type ?? "obra",
      status: p.status ?? "active",
      color: p.color ?? "#2563EB",
      budget,
      budget_alert_threshold: p.budget_alert_threshold ?? 80,
      total_spent: totals.spent,
      remaining: budget !== null ? budget - totals.spent : null,
      invoice_count: totals.count,
    }
  })

  const alerts = buildAlerts({
    creditsBalance: options.creditsBalance,
    plan: options.plan,
    activeProjects: active_projects,
  })

  return { year, month, mode, kpis, chart, active_projects, alerts }
}

function buildAnnualChart(
  currentMonth: number,
  currentYear: number,
  displayYear: number,
  mode: DashboardMode,
  selectedMonth: number,
  invoiceRows: Array<{ invoice_date: string | null; total: number | null; subtotal: number | null; type: string | null }>,
  snapshotRevenue: Map<number, number>,
  periodRevenue: number,
): ChartPoint[] {
  const result: ChartPoint[] = Array.from({ length: 12 }, (_, i) => ({
    month: PT_MONTHS[i],
    count: 0,
    value: 0,
    revenue: 0,
    expenses: 0,
    ebitda: 0,
  }))

  // Fill revenue from snapshots for past months
  if (displayYear === currentYear) {
    for (let m = 1; m <= 12; m++) {
      if (m < currentMonth) {
        result[m - 1].revenue = snapshotRevenue.get(m) ?? 0
      } else if (m === currentMonth && mode === "mensal") {
        result[m - 1].revenue = periodRevenue
      }
    }
  }

  // Fill expenses and outgoing revenue from invoice rows (without VAT = subtotal)
  for (const row of invoiceRows) {
    if (!row.invoice_date) continue
    const m = parseInt(row.invoice_date.slice(5, 7), 10)
    if (m < 1 || m > 12) continue
    const amount = Number(row.subtotal ?? row.total ?? 0)
    if (row.type === "incoming") {
      result[m - 1].expenses += amount
    } else if (row.type === "outgoing" && displayYear !== currentYear) {
      // For past years fill revenue from invoice rows directly (no snapshots)
      result[m - 1].revenue += amount
    }
    result[m - 1].count += 1
    result[m - 1].value += amount
  }

  // Calculate EBITDA per month
  for (const point of result) {
    point.ebitda = point.revenue - point.expenses
  }

  return result
}

function buildAlerts(input: {
  creditsBalance: number
  plan: string
  activeProjects: RecentProject[]
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = []

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
