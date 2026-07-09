import { redirect } from "next/navigation"
import {
  Activity,
  Banknote,
  Calculator,
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
import { formatCurrency } from "@/lib/utils/portugal"
import type { DashboardMode } from "@/lib/queries/dashboard"
import type { VatRegime } from "@/types"

const VALID_MODES: DashboardMode[] = ["mensal", "trimestral", "acumulado"]

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { mode?: string; month?: string; quarter?: string; year?: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (session.role === "investidor") redirect("/projetos")

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentQuarter = Math.ceil(currentMonth / 3)

  const hasParams = !!(searchParams.mode || searchParams.month || searchParams.quarter || searchParams.year)

  const mode: DashboardMode = VALID_MODES.includes(searchParams.mode as DashboardMode)
    ? (searchParams.mode as DashboardMode)
    : "mensal"
  const month = Math.min(12, Math.max(1, parseInt(searchParams.month ?? String(currentMonth), 10) || currentMonth))
  const quarter = Math.min(4, Math.max(1, parseInt(searchParams.quarter ?? String(currentQuarter), 10) || currentQuarter))
  const year = parseInt(searchParams.year ?? String(currentYear), 10) || currentYear

  const vatRegime = ((session.tenant as Record<string, unknown>).vat_regime as VatRegime) ?? "normal"

  const data = await getDashboardData(session.tenant.id, {
    vatRegime,
    mode,
    month,
    quarter,
    year,
  })

  const ebitdaLabel = data.kpis.ebitda >= 0
    ? `+${formatCurrency(data.kpis.ebitda)}`
    : formatCurrency(data.kpis.ebitda)

  const vatEndMonth = mode === "mensal" ? month : mode === "trimestral" ? quarter * 3 : 12
  const vatDeadlineMonth = vatEndMonth + 2 > 12 ? vatEndMonth + 2 - 12 : vatEndMonth + 2
  const vatDeadlineYear = vatEndMonth + 2 > 12 ? year + 1 : year
  const vatDeadlineLabel = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(vatDeadlineYear, vatDeadlineMonth - 1, 15))
  const vatDirection = data.kpis.vat_estimate > 0 ? "a pagar" : data.kpis.vat_estimate < 0 ? "a receber" : "equilibrado"

  const periodLabel = mode === "mensal"
    ? `mês ${String(month).padStart(2, "0")}/${year}`
    : mode === "trimestral"
    ? `T${quarter} ${year}`
    : `ano ${year}`

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Olá, {session.user.name.split(" ")[0]}. Resumo do {periodLabel}.
          </p>
        </div>
        <DashboardControls mode={mode} month={month} quarter={quarter} year={year} hasParams={hasParams} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Receita"
              value={formatCurrency(data.kpis.revenue)}
              icon={TrendingUp}
              hint={data.kpis.revenue_source === "toconline" ? "Fonte: ERP · sem IVA" : "Faturas emitidas · sem IVA"}
              variant="revenue"
            />
            <KpiCard
              label="Gastos"
              value={formatCurrency(data.kpis.expenses)}
              icon={TrendingDown}
              hint="Faturas recebidas · sem IVA"
              variant="expense"
            />
            <KpiCard
              label="EBITDA"
              value={ebitdaLabel}
              icon={Activity}
              hint={`${data.kpis.ebitda_pct >= 0 ? "+" : ""}${data.kpis.ebitda_pct}% da receita`}
              variant={data.kpis.ebitda >= 0 ? "ebitda-pos" : "ebitda-neg"}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Banco pendentes"
              value={`${data.kpis.bank_pending_pct}%`}
              icon={Banknote}
              hint={`${data.kpis.bank_pending_count} de ${data.kpis.bank_total_count} mov. no período`}
              variant="neutral"
            />
            <KpiCard
              label="e-Fatura pendentes"
              value={`${data.kpis.efatura_pending_pct}%`}
              icon={Receipt}
              hint={`${data.kpis.efatura_pending_count} de ${data.kpis.efatura_total_count} docs AT`}
              variant="neutral"
            />
            <KpiCard
              label={`Estimativa IVA (${vatDirection})`}
              value={formatCurrency(Math.abs(data.kpis.vat_estimate))}
              icon={Calculator}
              hint={`Prazo: ${vatDeadlineLabel}`}
              variant="neutral"
            />
          </div>
        </div>

        <div className="lg:col-span-2 h-full">
          <AlertsPanel alerts={data.alerts} />
        </div>
      </div>

      <InvoicesChart data={data.chart} year={year} />
      <ActiveProjects projects={data.active_projects} />
    </div>
  )
}
