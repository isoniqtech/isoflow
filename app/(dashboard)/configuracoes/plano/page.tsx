import Link from "next/link"
import { redirect } from "next/navigation"
import { Check, ChevronLeft, Coins, ExternalLink, ShoppingCart, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentSession } from "@/lib/queries/current-session"
import { hasPermission } from "@/lib/utils/permissions"
import { formatCurrency } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"

type PlanDef = {
  id: "starter" | "business" | "pro" | "enterprise"
  name: string
  price_monthly: number
  credits_monthly: number
  features: string[]
  caps: {
    invoices_per_month: string
    projects: string
    bank_accounts: string
    users: string
  }
}

const PLANS: PlanDef[] = [
  {
    id: "starter",
    name: "Starter",
    price_monthly: 79,
    credits_monthly: 500,
    features: [
      "WhatsApp + Email",
      "Conciliação bancária",
      "Suporte por ticket",
    ],
    caps: {
      invoices_per_month: "50 faturas",
      projects: "5 projetos",
      bank_accounts: "1 banco",
      users: "2 utilizadores",
    },
  },
  {
    id: "business",
    name: "Business",
    price_monthly: 179,
    credits_monthly: 1500,
    features: [
      "Tudo do Starter",
      "Integração ERP",
      "Comunicação AT (Atura)",
    ],
    caps: {
      invoices_per_month: "200 faturas",
      projects: "20 projetos",
      bank_accounts: "3 bancos",
      users: "5 utilizadores",
    },
  },
  {
    id: "pro",
    name: "Pro",
    price_monthly: 349,
    credits_monthly: 5000,
    features: [
      "Tudo do Business",
      "Faturas ilimitadas",
      "Suporte prioritário",
    ],
    caps: {
      invoices_per_month: "Ilimitadas",
      projects: "Ilimitados",
      bank_accounts: "Ilimitados",
      users: "15 utilizadores",
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price_monthly: 599,
    credits_monthly: 999_999,
    features: [
      "Tudo do Pro",
      "Custom SLA",
      "Suporte dedicado",
      "Onboarding assistido",
    ],
    caps: {
      invoices_per_month: "Ilimitadas",
      projects: "Ilimitados",
      bank_accounts: "Ilimitados",
      users: "Ilimitados",
    },
  },
]

const CREDIT_PACKS = [
  { credits: 500, price: 29 },
  { credits: 1500, price: 79 },
  { credits: 5000, price: 199 },
]

export default async function PlanoPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "billing", "view_all")) {
    redirect("/configuracoes")
  }

  const currentPlan = PLANS.find((p) => p.id === session.tenant.plan) ?? PLANS[0]
  const balance = session.tenant.credits_balance
  const used = session.tenant.credits_used_this_month
  const quota = currentPlan.credits_monthly
  const usedPct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/configuracoes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Configurações
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Plano e créditos</h1>
        <p className="text-muted-foreground text-sm">
          Subscrição atual, consumo deste mês e packs avulso.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">{currentPlan.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCurrency(currentPlan.price_monthly)} / mês ·{" "}
              {currentPlan.credits_monthly.toLocaleString("pt-PT")} créditos
            </p>
          </div>
          <Badge variant="outline" className="capitalize">
            {currentPlan.id === "starter" ? "Trial / Plano atual" : "Plano atual"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium flex items-center gap-1.5">
                <Coins className="h-4 w-4" />
                Créditos
              </span>
              <span className="tabular-nums text-muted-foreground">
                {balance.toLocaleString("pt-PT")} disponíveis ·{" "}
                {used.toLocaleString("pt-PT")} usados este mês
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-foreground transition-all"
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled title="Stripe ainda não configurado">
              Mudar de plano
            </Button>
            <Button variant="outline" disabled title="Stripe ainda não configurado">
              <ExternalLink className="mr-2 h-4 w-4" />
              Gerir faturação
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Comparar planos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan.id
            return (
              <Card
                key={plan.id}
                className={cn(
                  "flex flex-col",
                  isCurrent && "ring-2 ring-foreground",
                )}
              >
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {plan.name}
                    {isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        Atual
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-2xl font-semibold tabular-nums">
                    {plan.id === "enterprise"
                      ? `${formatCurrency(plan.price_monthly)}+`
                      : formatCurrency(plan.price_monthly)}
                    <span className="text-xs text-muted-foreground font-normal">
                      {" "}
                      /mês
                    </span>
                  </p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <p className="text-sm font-medium">
                    {plan.credits_monthly === 999_999
                      ? "Custom"
                      : `${plan.credits_monthly.toLocaleString("pt-PT")} créditos/mês`}
                  </p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground flex-1">
                    <li className="flex items-baseline gap-2">
                      <Check className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
                      <span>{plan.caps.invoices_per_month}</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                      <Check className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
                      <span>{plan.caps.projects}</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                      <Check className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
                      <span>{plan.caps.bank_accounts}</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                      <Check className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
                      <span>{plan.caps.users}</span>
                    </li>
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-baseline gap-2">
                        <Check className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Packs avulso de créditos
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.credits}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {pack.credits.toLocaleString("pt-PT")}
                  </p>
                  <p className="text-xs text-muted-foreground">créditos</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {formatCurrency(pack.price)}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    disabled
                    title="Stripe ainda não configurado"
                  >
                    <ShoppingCart className="mr-1.5 h-3 w-3" />
                    Comprar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-3">
        <X className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p>
          Os pagamentos via Stripe ainda não estão ligados. Quando configurares
          a chave Stripe e os Price IDs no <code className="text-xs">.env.local</code>,
          os botões de mudar plano e comprar créditos ficam ativos.
        </p>
      </div>
    </div>
  )
}
