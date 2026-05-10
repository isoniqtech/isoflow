import { redirect } from "next/navigation"
import { CheckCircle2, Coins, Euro, FileText } from "lucide-react"
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

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Olá, {session.user.name.split(" ")[0]}. Aqui está o resumo deste mês.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Faturas este mês"
          value={data.kpis.invoices_this_month.toLocaleString("pt-PT")}
          icon={FileText}
          hint="Recebidas e processadas"
        />
        <KpiCard
          label="Valor total"
          value={formatCurrency(data.kpis.total_value_this_month)}
          icon={Euro}
          hint="Soma das faturas deste mês"
        />
        <KpiCard
          label="% Conciliadas"
          value={`${data.kpis.matched_pct}%`}
          icon={CheckCircle2}
          hint={`${data.kpis.matched_count} de ${data.kpis.invoices_this_month} faturas`}
        />
        <KpiCard
          label="Créditos disponíveis"
          value={session.tenant.credits_balance.toLocaleString("pt-PT")}
          icon={Coins}
          hint={`Plano ${session.tenant.plan}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <InvoicesChart data={data.chart} />
        </div>
        <AlertsPanel alerts={data.alerts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentInvoices invoices={data.recent_invoices} />
        </div>
        <ActiveProjects projects={data.active_projects} />
      </div>
    </div>
  )
}
