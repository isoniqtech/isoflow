import { createClient } from "@/lib/supabase/server"
import type { InvoiceStatus, InvoiceSource } from "@/types"

export type DashboardKpis = {
  invoices_this_month: number
  total_value_this_month: number
  matched_count: number
  matched_pct: number
  revenue_this_month: number
  expenses_this_month: number
  net_this_month: number
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
  kpis: DashboardKpis
  chart: ChartPoint[]
  recent_invoices: RecentInvoice[]
  active_projects: RecentProject[]
  alerts: DashboardAlert[]
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
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [{ data: monthInvoices }, { data: recentInvoicesData }, { data: projectsData }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, total, status, invoice_date, created_at, type")
        .eq("tenant_id", tenantId)
        .gte("created_at", startOfMonth.toISOString())
        .neq("status", "rejected"),
      supabase
        .from("invoices")
        .select(
          "id, supplier_name, invoice_number, total, status, source, invoice_date, created_at",
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("projects")
        .select(
          "id, name, type, status, color, budget, budget_alert_threshold, created_at",
        )
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4),
    ])

  const monthList = monthInvoices ?? []
  const invoicesThisMonth = monthList.length
  const totalValue = monthList.reduce(
    (sum, i) => sum + Number(i.total ?? 0),
    0,
  )
  const matched = monthList.filter(
    (i) => i.status === "matched" || i.status === "paid",
  ).length
  const matchedPct =
    invoicesThisMonth > 0
      ? Math.round((matched / invoicesThisMonth) * 100)
      : 0

  const revenue = monthList
    .filter((i) => i.type === "outgoing")
    .reduce((s, i) => s + Number(i.total ?? 0), 0)
  const expenses = monthList
    .filter((i) => i.type === "incoming")
    .reduce((s, i) => s + Number(i.total ?? 0), 0)

  const kpis: DashboardKpis = {
    invoices_this_month: invoicesThisMonth,
    total_value_this_month: totalValue,
    matched_count: matched,
    matched_pct: matchedPct,
    revenue_this_month: revenue,
    expenses_this_month: expenses,
    net_this_month: revenue - expenses,
  }

  const { data: chartRows } = await supabase
    .from("invoices")
    .select("created_at, total, type")
    .eq("tenant_id", tenantId)
    .gte("created_at", sixMonthsAgo.toISOString())
    .neq("status", "rejected")

  const chart = buildChart(chartRows ?? [], sixMonthsAgo)

  const recent_invoices: RecentInvoice[] = (recentInvoicesData ?? []).map(
    (row) => ({
      id: row.id,
      supplier_name: row.supplier_name,
      invoice_number: row.invoice_number,
      total: row.total !== null ? Number(row.total) : null,
      status: (row.status ?? "pending") as InvoiceStatus,
      source: (row.source ?? "manual") as InvoiceSource,
      invoice_date: row.invoice_date,
      created_at: row.created_at ?? new Date().toISOString(),
    }),
  )

  const projects = projectsData ?? []
  const projectIds = projects.map((p) => p.id)

  let projectInvoiceTotals = new Map<string, { spent: number; count: number }>()
  if (projectIds.length) {
    const { data: projInvoices } = await supabase
      .from("invoices")
      .select("project_id, total")
      .eq("tenant_id", tenantId)
      .in("project_id", projectIds)
      .neq("status", "rejected")

    for (const row of projInvoices ?? []) {
      if (!row.project_id) continue
      const current = projectInvoiceTotals.get(row.project_id) ?? {
        spent: 0,
        count: 0,
      }
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

  return {
    kpis,
    chart,
    recent_invoices,
    active_projects,
    alerts,
  }
}

function buildChart(
  rows: Array<{ created_at: string | null; total: number | null; type: string | null }>,
  startMonth: Date,
): ChartPoint[] {
  const buckets = new Map<string, { count: number; value: number; revenue: number; expenses: number }>()

  for (let i = 0; i < 6; i++) {
    const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    buckets.set(key, { count: 0, value: 0, revenue: 0, expenses: 0 })
  }

  for (const row of rows) {
    if (!row.created_at) continue
    const d = new Date(row.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const b = buckets.get(key)
    if (!b) continue
    const amount = Number(row.total ?? 0)
    b.count += 1
    b.value += amount
    if (row.type === "outgoing") b.revenue += amount
    else b.expenses += amount
  }

  return Array.from(buckets.entries()).map(([key, v]) => {
    const [, monthStr] = key.split("-")
    const monthIdx = parseInt(monthStr, 10) - 1
    return {
      month: PT_MONTHS[monthIdx] ?? monthStr,
      count: v.count,
      value: v.value,
      revenue: v.revenue,
      expenses: v.expenses,
    }
  })
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

  const noProject = input.recentInvoices.filter(
    (i) => i.status !== "rejected" && !("project_id" in i),
  )
  if (noProject.length > 0) {
    alerts.push({
      id: "no-project",
      level: "warn",
      title: `${noProject.length} fatura(s) sem projeto`,
      description: "Atribui um projeto para melhor controlo de custos.",
      href: "/faturas",
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
        description: `Restam ${input.creditsBalance.toLocaleString("pt-PT")} créditos. Considera recarregar.`,
        href: "/configuracoes/plano",
      })
    }
  }

  return alerts
}
