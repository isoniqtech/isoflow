import Link from "next/link"
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileText,
  FolderKanban,
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
      "Lê fornecedor, NIF, valores, IVA e data de vencimento. Confiança superior a 95%, sem digitação manual.",
  },
  {
    icon: FolderKanban,
    title: "Gestão de Projetos",
    description:
      "Associa cada fatura ao projeto certo. Controla orçamentos e recebe alertas quando estás a aproximar-te do limite.",
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
      "O fornecedor envia por WhatsApp, email ou fazes upload manual. Qualquer formato: PDF, JPG ou PNG.",
  },
  {
    number: "02",
    title: "IA processa e organiza",
    description:
      "Extrai todos os dados em segundos e associa ao projeto certo. Assinala o que precisa de revisão.",
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
    price: "49",
    description: "Para pequenas empresas a começar.",
    features: [
      "5 projetos",
      "3 contas bancárias",
      "3 utilizadores",
      "WhatsApp + Email",
      "Conciliação bancária",
      "Até 1 GB de espaço",
      "Comunicação AT",
      "Integração ERP",
      "Suporte por ticket",
    ],
    highlighted: false,
    cta: "Pedir demonstração",
  },
  {
    name: "Business",
    price: "89",
    description: "O mais escolhido por PMEs em crescimento.",
    features: [
      "Tudo do Starter",
      "Projetos ilimitados",
      "Bancos ilimitados",
      "Até 15 utilizadores",
      "Até 5 GB de espaço",
      "Suporte por ticket",
    ],
    highlighted: true,
    cta: "Pedir demonstração",
  },
  {
    name: "Investor",
    price: "129",
    description: "Para empresas e grupos em crescimento.",
    features: [
      "Tudo do Business",
      "Até 50 utilizadores",
      "Até 15 GB de espaço",
      "Suporte assistido",
    ],
    highlighted: false,
    cta: "Pedir demonstração",
  },
]

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "info@isoniqtech.com"

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-secondary/30 to-background pt-20 pb-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge
            variant="outline"
            className="mb-6 border-border text-muted-foreground animate-in fade-in duration-500 motion-reduce:animate-none"
          >
            Desenvolvido em Portugal, para empresas portuguesas
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-foreground mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none">
            Faturas e projetos{" "}
            <span className="spectrum-text">sob controlo.</span>
            <br />
            Automaticamente.
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 motion-reduce:animate-none">
            Recebe faturas por WhatsApp ou email. A IA extrai os dados, associa ao projeto certo e concilia com o banco.
            Tu só confirmas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 motion-reduce:animate-none">
            <Button
              size="lg"
              className="text-base px-8 transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 btn-glow active:scale-95"
              asChild
            >
              <a href="#contacto">
                Pedir demonstração
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 hover:bg-secondary active:scale-95"
              asChild
            >
              <a href="#precos">Ver preços</a>
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="max-w-3xl mx-auto mt-20 grid grid-cols-3 gap-4 sm:gap-8 text-center animate-in fade-in duration-1000 delay-500 motion-reduce:animate-none">
          {[
            { value: "< 5s", label: "por fatura processada" },
            { value: "+95%", label: "de precisão na extração" },
            { value: "0", label: "digitação manual necessária" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-foreground">{stat.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
              Tudo o que precisas numa só plataforma
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Desde a receção da fatura até à comunicação com o ERP, sem sair do ISOFlow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <Card
                  key={feature.title}
                  className="border-border/60 bg-card shadow-[var(--shadow-card,none)] transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 cursor-default"
                >
                  <CardHeader className="pb-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center mb-3"
                      style={{ background: "linear-gradient(135deg, #4E7217, #3DAEAF)" }}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="font-display text-base">{feature.title}</CardTitle>
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
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
              Como funciona
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Em três passos simples, da fatura ao ERP.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative flex flex-col items-center text-center md:items-start md:text-left group">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl font-black text-primary/15 leading-none transition-colors duration-200 group-hover:text-primary/30">
                    {step.number}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:block absolute left-1/2 top-5 w-full h-px bg-border" />
                  )}
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{step.title}</h3>
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
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
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
                    ? "border-2 border-primary shadow-[var(--shadow-card,none)] relative transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
                    : "border-border/60 shadow-[var(--shadow-card,none)] transition-all duration-200 hover:shadow-md hover:-translate-y-1 hover:border-primary/30"
                }
                style={plan.highlighted
                  ? { background: "linear-gradient(160deg, hsl(var(--card)) 0%, rgba(61,174,175,0.06) 100%)" }
                  : undefined
                }
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground hover:bg-primary text-xs px-3">
                      Mais popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="font-display text-lg">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="font-display text-4xl font-semibold">{plan.price}€</span>
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
                    className="w-full mt-2 transition-all duration-200 hover:scale-105 active:scale-95"
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
          <Card className="border-border/60 bg-muted/30 shadow-[var(--shadow-card,none)] transition-all duration-200 hover:shadow-md">
            <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-display font-semibold">Enterprise</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Tudo do Investor, utilizadores e espaço personalizados, SLA dedicado e integração à medida.
                  Preço personalizado.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0 transition-all duration-200 hover:scale-105 hover:bg-primary/10 hover:border-primary/40 hover:text-primary active:scale-95"
                asChild
              >
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
              <div key={text} className="flex items-center gap-2 transition-colors duration-200 hover:text-foreground">
                <Icon className="h-4 w-4 shrink-0 text-[#3DAEAF]" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contacto" className="py-24 px-4 sm:px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
            Pronto para começar?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
            Entra em contacto. A equipa ISONIQ TECH trata de tudo:
            configuração, integração e formação incluídas na implementação.
          </p>

          <Card className="border-border/60 bg-card shadow-[var(--shadow-card,none)] text-left">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #4E7217, #3DAEAF)" }}
                >
                  <MessageCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-sm text-[#3DAEAF] hover:underline"
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

              <Button
                className="w-full transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-95 btn-glow"
                size="lg"
                asChild
              >
                <a href={`mailto:${CONTACT_EMAIL}?subject=Pedido de demonstração ISOFlow`}>
                  Enviar pedido de demonstração
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>

              <Button
                className="w-full transition-all duration-200 hover:scale-[1.02] hover:bg-primary/10 hover:border-primary/40 hover:text-primary active:scale-95"
                variant="outline"
                size="lg"
                asChild
              >
                <Link href="/login">Já tenho conta. Entrar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  )
}
