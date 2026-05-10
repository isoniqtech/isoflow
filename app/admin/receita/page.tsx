import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { Coins, TrendingUp, UserPlus } from "lucide-react"
import { getAdminOverview } from "@/lib/queries/admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { TenantPlan } from "@/types"

const PLAN_LABELS: Record<TenantPlan, string> = {
  starter: "Starter",
  business: "Business",
  pro: "Pro",
  enterprise: "Enterprise",
}

export default async function AdminReceitaPage() {
  const overview = await getAdminOverview()

  // Recent signups list
  const supabase = createAdminClient()
  const { data: recentTenants } = await supabase
    .from("tenants")
    .select("id, name, plan, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10)

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receita</h1>
        <p className="text-muted-foreground text-sm">
          MRR, distribuição por plano e novos clientes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="MRR total"
          value={formatCurrency(overview.mrr_total)}
          icon={Coins}
          hint={`${overview.tenants_active} clientes ativos`}
        />
        <KpiCard
          label="Novos este mês"
          value={overview.new_tenants_this_month.toString()}
          icon={UserPlus}
        />
        <KpiCard
          label="Taxa trial → ativo"
          value="—"
          icon={TrendingUp}
          hint="Em breve (precisa histórico)"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Distribuição por plano</CardTitle>
          <CardDescription>
            MRR e contagem de clientes em cada plano (apenas estado &quot;ativo&quot;).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {overview.revenue_by_plan.map((row) => {
              const pct =
                overview.mrr_total > 0
                  ? (row.mrr / overview.mrr_total) * 100
                  : 0
              return (
                <li key={row.plan} className="py-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {PLAN_LABELS[row.plan]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
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
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-foreground transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Últimos signups</CardTitle>
          <CardDescription>Os 10 tenants mais recentes.</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentTenants || recentTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem signups.</p>
          ) : (
            <ul className="divide-y">
              {recentTenants.map((t) => (
                <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.created_at ? formatDate(t.created_at) : "—"} ·{" "}
                      <span className="capitalize">{t.status}</span>
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {t.plan}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        Gráficos de evolução temporal (MRR mês-a-mês, churn, novos clientes
        por mês) requerem histórico mais aprofundado e ligação ao Stripe.
        Adicionados quando o Stripe estiver configurado.
      </div>
    </div>
  )
}
