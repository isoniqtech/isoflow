import { redirect } from "next/navigation"
import { Activity, CheckCircle2, Clock, FileText, TrendingDown, TrendingUp } from "lucide-react"
import { getCurrentSession } from "@/lib/queries/current-session"
import { getDashboardData } from "@/lib/queries/dashboard"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { AlertsPanel } from "@/components/dashboard/alerts-panel"
import { InvoicesChart } from "@/components/dashboard/invoices-chart"
import { RecentInvoices } from "@/components/dashboard/recent-invoices"
import { ActiveProjects } from "@/components/dashboard/active-projects"
import { formatCurrency } from "@/lib/utils/portugal"

export default async function DashboardPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")

  const data = await getDashboardData(session.tenant.id, {
    creditsBalance: session.tenant.credits_balance,
    plan: session.tenant.plan,
  })

  const net = data.kpis.net_this_month
  const netLabel = net >= 0
    ? `+${formatCurrency(net)}`
    : formatCurrency(net)

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Olá, {session.user.name.split(" ")[0]}. Aqui está o resumo deste mês.
        </p>
      </div>

      {/* KPIs (3+3) + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Receita este mês"
            value={formatCurrency(data.kpis.revenue_this_month)}
            icon={TrendingUp}
            hint={data.kpis.revenue_source === "toconline" ? "Fonte: Toconline" : "Faturas emitidas"}
          />
          <KpiCard
            label="Gastos este mês"
            value={formatCurrency(data.kpis.expenses_this_month)}
            icon={TrendingDown}
            hint="Faturas recebidas"
          />
          <KpiCard
            label="EBITDA"
            value={netLabel}
            icon={Activity}
            hint="Receita menos gastos"
          />
          <KpiCard
            label="Faturas este mês"
            value={data.kpis.invoices_this_month.toLocaleString("pt-PT")}
            icon={FileText}
            hint="Recebidas e processadas"
          />
          <KpiCard
            label="% Conciliadas"
            value={`${data.kpis.matched_pct}%`}
            icon={CheckCircle2}
            hint={`${data.kpis.matched_count} de ${data.kpis.invoices_this_month} faturas`}
          />
          <KpiCard
            label="Pendentes"
            value={data.kpis.pending_count.toLocaleString("pt-PT")}
            icon={Clock}
            hint="A aguardar processamento"
          />
        </div>

        <AlertsPanel alerts={data.alerts} />
      </div>

      {/* Gráfico anual full-width */}
      <InvoicesChart data={data.chart} year={data.year} />

      {/* Faturas recentes + Projetos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentInvoices invoices={data.recent_invoices} />
        </div>
        <ActiveProjects projects={data.active_projects} />
      </div>
    </div>
  )
}
