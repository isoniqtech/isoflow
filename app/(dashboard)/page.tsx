import { redirect } from "next/navigation"
import {
  Activity,
  Banknote,
  FileText,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { getCurrentSession } from "@/lib/queries/current-session"
import { getDashboardData } from "@/lib/queries/dashboard"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { AlertsPanel } from "@/components/dashboard/alerts-panel"
import { InvoicesChart } from "@/components/dashboard/invoices-chart"
import { ActiveProjects } from "@/components/dashboard/active-projects"
import { DashboardControls } from "@/components/dashboard/dashboard-controls"
import { VatEstimateCard } from "@/components/dashboard/vat-estimate-card"
import { formatCurrency } from "@/lib/utils/portugal"
import type { DashboardMode } from "@/lib/queries/dashboard"
import type { VatRegime } from "@/types"

const VALID_MODES: DashboardMode[] = ["mensal", "acumulado"]

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { mode?: string; month?: string; year?: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const mode: DashboardMode = VALID_MODES.includes(searchParams.mode as DashboardMode)
    ? (searchParams.mode as DashboardMode)
    : "mensal"
  const month = Math.min(12, Math.max(1, parseInt(searchParams.month ?? String(currentMonth), 10) || currentMonth))
  const year = parseInt(searchParams.year ?? String(currentYear), 10) || currentYear

  const vatRegime = ((session.tenant as Record<string, unknown>).vat_regime as VatRegime) ?? "normal"

  const data = await getDashboardData(session.tenant.id, {
    creditsBalance: session.tenant.credits_balance,
    plan: session.tenant.plan,
    vatRegime,
    mode,
    month,
    year,
  })

  const ebitdaLabel = data.kpis.ebitda >= 0
    ? `+${formatCurrency(data.kpis.ebitda)}`
    : formatCurrency(data.kpis.ebitda)

  const periodLabel = mode === "mensal"
    ? `mês ${String(month).padStart(2, "0")}/${year}`
    : `ano ${year}`

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Olá, {session.user.name.split(" ")[0]}. Resumo do {periodLabel}.
          </p>
        </div>
        <DashboardControls mode={mode} month={month} year={year} />
      </div>

      {/* KPIs + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Linha 1 — Receita, Gastos, EBITDA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Receita"
              value={formatCurrency(data.kpis.revenue)}
              icon={TrendingUp}
              hint={data.kpis.revenue_source === "toconline" ? "Fonte: Toconline · sem IVA" : "Faturas emitidas · sem IVA"}
            />
            <KpiCard
              label="Gastos"
              value={formatCurrency(data.kpis.expenses)}
              icon={TrendingDown}
              hint="Faturas recebidas · sem IVA"
            />
            <KpiCard
              label="EBITDA"
              value={ebitdaLabel}
              icon={Activity}
              hint={`${data.kpis.ebitda_pct >= 0 ? "+" : ""}${data.kpis.ebitda_pct}% da receita`}
            />
          </div>
          {/* Linha 2 — Banco pendentes, e-Fatura pendentes, Nº faturas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Banco pendentes"
              value={`${data.kpis.bank_pending_pct}%`}
              icon={Banknote}
              hint={`${data.kpis.bank_pending_count} de ${data.kpis.bank_total_count} movimentos`}
            />
            <KpiCard
              label="e-Fatura pendentes"
              value={`${data.kpis.efatura_pending_pct}%`}
              icon={Receipt}
              hint={`${data.kpis.efatura_pending_count} de ${data.kpis.efatura_total_count} docs AT`}
            />
            <KpiCard
              label="Faturas"
              value={data.kpis.invoices_this_period.toLocaleString("pt-PT")}
              icon={FileText}
              hint="No período selecionado"
            />
          </div>
        </div>

        <div className="lg:col-span-2 h-full">
          <AlertsPanel alerts={data.alerts} />
        </div>
      </div>

      {/* Estimativa IVA */}
      <VatEstimateCard vatRegime={vatRegime} />

      {/* Gráfico anual */}
      <InvoicesChart data={data.chart} year={year} />

      {/* Projetos */}
      <ActiveProjects projects={data.active_projects} />
    </div>
  )
}
