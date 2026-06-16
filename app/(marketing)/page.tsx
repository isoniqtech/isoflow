import Link from "next/link"
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  CheckCircle2,
  FileText,
  Landmark,
  Link2,
  MessageCircle,
  BarChart3,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const FEATURES = [
  {
    icon: MessageCircle,
    title: "WhatsApp & Email",
    description:
      "Envia a fatura para o número da empresa. Sem portais, sem logins. A plataforma recebe e processa automaticamente.",
  },
  {
    icon: BrainCircuit,
    title: "Extração com IA",
    description:
      "Lê fornecedor, NIF, valores, IVA e data de vencimento. Confiança superior a 95% — sem digitação manual.",
  },
  {
    icon: Building2,
    title: "Projetos & Obras",
    description:
      "Associa cada fatura ao projeto ou obra certa. Controla orçamentos e recebe alertas quando estás a aproximar-te do limite.",
  },
  {
    icon: Landmark,
    title: "Conciliação Bancária",
    description:
      "Importa movimentos do banco e cruza automaticamente com as faturas. Match automático ou confirmação manual.",
  },
  {
    icon: Link2,
    title: "Integração ERP",
    description:
      "Fatura entra no ISOFlow, sai no TOConline. Sem dupla introdução de dados. Sincronização de compras e vendas.",
  },
  {
    icon: BarChart3,
    title: "Relatórios & AT",
    description:
      "Dashboard com receita, gastos e EBITDA por período. Estimativa de IVA automática. Exporta relatórios em PDF por projeto.",
  },
]

const STEPS = [
  {
    number: "01",
    title: "Recebes a fatura",
    description:
      "O fornecedor envia por WhatsApp, email ou fazes upload manual. Qualquer formato — PDF, JPG ou PNG.",
  },
  {
    number: "02",
    title: "IA processa e organiza",
    description:
      "Extrai todos os dados em segundos e associa ao projeto ou obra certa. Assinala o que precisa de revisão.",
  },
  {
    number: "03",
    title: "Sincroniza e exporta",
    description:
      "Confirmas a conciliação bancária, sincronizas com o ERP e exportas relatórios. Tudo num só lugar.",
  },
]

const PLANS = [
  {
    name: "Starter",
    price: "79",
    description: "Para pequenas empresas a começar.",
    features: [
      "50 faturas / mês",
      "5 projetos",
      "1 conta bancária",
      "2 utilizadores",
      "500 créditos IA / mês",
      "Suporte por email",
    ],
    highlighted: false,
    cta: "Pedir demonstração",
  },
  {
    name: "Business",
    price: "179",
    description: "O mais escolhido por PMEs em crescimento.",
    features: [
      "200 faturas / mês",
      "20 projetos",
      "3 contas bancárias",
      "5 utilizadores",
      "1.500 créditos IA / mês",
      "Integração ERP incluída",
      "Suporte prioritário",
    ],
    highlighted: true,
    cta: "Pedir demonstração",
  },
  {
    name: "Pro",
    price: "349",
    description: "Faturas e projetos sem limites.",
    features: [
      "Faturas ilimitadas",
      "Projetos ilimitados",
      "Contas bancárias ilimitadas",
      "15 utilizadores",
      "5.000 créditos IA / mês",
      "Integração ERP incluída",
      "Suporte dedicado",
    ],
    highlighted: false,
    cta: "Pedir demonstração",
  },
]

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "geral@isoniqtech.com"

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 to-background dark:from-blue-950/20 dark:to-background pt-20 pb-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 text-blue-700 border-blue-200 bg-blue-50 dark:text-blue-300 dark:border-blue-800 dark:bg-blue-950/50">
            Desenvolvido em Portugal, para empresas portuguesas
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            Faturas e obras{" "}
            <span className="text-blue-600 dark:text-blue-400">sob controlo.</span>
            <br />
            Automaticamente.
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Recebe faturas por WhatsApp ou email. A IA extrai os dados, associa ao projeto certo e concilia com o banco.
            Tu só confirmas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="text-base px-8" asChild>
              <a href="#contacto">
                Pedir demonstração
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" asChild>
              <a href="#precos">Ver preços</a>
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="max-w-3xl mx-auto mt-20 grid grid-cols-3 gap-4 sm:gap-8 text-center">
          {[
            { value: "< 5s", label: "por fatura processada" },
            { value: "+95%", label: "de precisão na extração IA" },
            { value: "0", label: "digitação manual necessária" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Tudo o que precisas numa só plataforma
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Desde a receção da fatura até à comunicação com o ERP — sem sair do ISOFlow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="border bg-card hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Como funciona
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Em três passos simples, da fatura ao ERP.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative flex flex-col items-center text-center md:items-start md:text-left">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl font-black text-blue-600/20 dark:text-blue-400/20 leading-none">
                    {step.number}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:block absolute left-1/2 top-5 w-full h-px bg-border" />
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Preços simples e transparentes
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Sem surpresas. Cancela quando quiseres.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.highlighted
                    ? "border-2 border-blue-600 dark:border-blue-400 shadow-lg relative"
                    : "border"
                }
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-xs px-3">
                      Mais popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-bold">{plan.price}€</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-2"
                    variant={plan.highlighted ? "default" : "outline"}
                    asChild
                  >
                    <a href="#contacto">{plan.cta}</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Enterprise */}
          <Card className="border bg-muted/30">
            <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Enterprise</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Utilizadores ilimitados, créditos personalizados, SLA dedicado e integração à medida.
                  A partir de 599€/mês.
                </p>
              </div>
              <Button variant="outline" className="shrink-0" asChild>
                <a href={`mailto:${CONTACT_EMAIL}`}>Falar com vendas</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust / Compliance */}
      <section className="py-12 px-4 sm:px-6 bg-muted/30 border-y">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-14 text-sm text-muted-foreground">
            {[
              { icon: Shield, text: "Dados alojados na União Europeia" },
              { icon: FileText, text: "Conforme com RGPD" },
              { icon: Landmark, text: "Preparado para e-Fatura e AT" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contacto" className="py-24 px-4 sm:px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Pronto para começar?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
            Entra em contacto. A equipa ISONIQ TECH trata de tudo —
            configuração, integração e formação incluídas na implementação.
          </p>

          <Card className="border bg-card text-left">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>

              <Separator />

              <p className="text-xs text-muted-foreground">
                Respondemos em menos de 24 horas úteis. Agendamos uma demonstração gratuita
                e configuramos a tua empresa sem custo inicial.
              </p>

              <Button className="w-full" size="lg" asChild>
                <a href={`mailto:${CONTACT_EMAIL}?subject=Pedido de demonstração ISOFlow`}>
                  Enviar pedido de demonstração
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>

              <Button className="w-full" variant="outline" size="lg" asChild>
                <Link href="/login">Já tenho conta — Entrar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  )
}
