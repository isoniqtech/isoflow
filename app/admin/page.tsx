import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  Euro,
  LifeBuoy,
  Sparkles,
  Users,
} from "lucide-react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAdminOverview } from "@/lib/queries/admin"
import { formatCurrency } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"

const PLAN_LABELS = {
  starter: "Starter",
  business: "Business",
  pro: "Pro",
  enterprise: "Enterprise",
}

export default async function AdminOverviewPage() {
  const data = await getAdminOverview()

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-muted-foreground text-sm">
          Métricas globais da plataforma ISOFlow.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="MRR"
          value={formatCurrency(data.mrr_total)}
          icon={Euro}
          hint={`${data.tenants_active} ativos`}
        />
        <KpiCard
          label="Tenants total"
          value={data.tenants_total.toString()}
          icon={Users}
          hint={`${data.tenants_trial} em trial`}
        />
        <KpiCard
          label="Novos este mês"
          value={data.new_tenants_this_month.toString()}
          icon={Sparkles}
        />
        <KpiCard
          label="Tickets abertos"
          value={data.open_tickets.toString()}
          icon={LifeBuoy}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Receita por plano
              </CardTitle>
              <Link
                href="/admin/receita"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center"
              >
                Detalhes
                <ArrowUpRight className="h-3 w-3 ml-0.5" />
              </Link>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {data.revenue_by_plan.map((row) => (
                  <li
                    key={row.plan}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="capitalize">
                        {PLAN_LABELS[row.plan]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {row.count} {row.count === 1 ? "cliente" : "clientes"}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(row.mrr)}
                      <span className="text-xs text-muted-foreground font-normal">
                        {" "}
                        /mês
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem alertas.</p>
            ) : (
              <ul className="space-y-2">
                {data.alerts.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href ?? "#"}
                      className={cn(
                        "block rounded-md border p-3",
                        a.level === "danger"
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10",
                      )}
                    >
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
