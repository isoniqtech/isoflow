import Link from "next/link"
import { redirect } from "next/navigation"
import { Check, ChevronLeft, ExternalLink, ArrowRight } from "lucide-react"
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
  price_monthly: number | null
  features: string[]
}

const PLANS: PlanDef[] = [
  {
    id: "starter",
    name: "Starter",
    price_monthly: 49,
    features: [
      "5 projetos",
      "3 bancos",
      "3 utilizadores",
      "WhatsApp + Email",
      "Conciliacao bancaria",
      "Ate 1 GB de espaco",
      "Comunicacao AT",
      "Integracao ERP",
      "Suporte por ticket",
    ],
  },
  {
    id: "business",
    name: "Business",
    price_monthly: 89,
    features: [
      "Tudo do Starter",
      "Projetos ilimitados",
      "Bancos ilimitados",
      "Ate 15 utilizadores",
      "Ate 5 GB de espaco",
      "Suporte por ticket",
    ],
  },
  {
    id: "pro",
    name: "Investor",
    price_monthly: 129,
    features: [
      "Tudo do Business",
      "Ate 50 utilizadores",
      "Ate 15 GB de espaco",
      "Suporte assistido",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price_monthly: null,
    features: [
      "Tudo do Investor",
      "Utilizadores custom",
      "Espaco custom",
      "Suporte assistido",
    ],
  },
]

export default async function PlanoPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "billing", "view_all")) {
    redirect("/configuracoes")
  }

  const currentPlan = PLANS.find((p) => p.id === session.tenant.plan) ?? PLANS[0]

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
        <h1 className="text-2xl font-semibold tracking-tight">Plano</h1>
        <p className="text-muted-foreground text-sm">
          Subscricao atual e comparacao de planos.
        </p>
      </div>

      {/* Plano atual */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">{currentPlan.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {currentPlan.price_monthly
                ? `${formatCurrency(currentPlan.price_monthly)} / mes`
                : "Preco personalizado"}
            </p>
          </div>
          <Badge variant="outline">Plano atual</Badge>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button disabled title="Stripe ainda nao configurado">
              Mudar de plano
            </Button>
            <Button variant="outline" disabled title="Stripe ainda nao configurado">
              <ExternalLink className="mr-2 h-4 w-4" />
              Gerir faturacao
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparar planos */}
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
                    {plan.price_monthly
                      ? <>
                          {formatCurrency(plan.price_monthly)}
                          <span className="text-xs text-muted-foreground font-normal"> /mes</span>
                        </>
                      : <span className="text-xl">Custom</span>
                    }
                  </p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <ul className="space-y-1.5 text-xs text-muted-foreground flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-baseline gap-2">
                        <Check className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button size="sm" variant="outline" disabled className="w-full">
                      Plano atual
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full" disabled title="Checkout em breve">
                      Escolher plano
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Todos os planos requerem um setup inicial que inclui configuracao do ERP e dados financeiros iniciais, WhatsApp e email.
      </p>
    </div>
  )
}
