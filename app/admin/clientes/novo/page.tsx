"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  Loader2,
  User,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils/portugal"
import type { TenantPlan, BillingCycle } from "@/types"

const PLANS: {
  id: TenantPlan
  name: string
  price: number
  credits: number
  label: string
}[] = [
  { id: "starter", name: "Starter", price: 79, credits: 500, label: "50 fat · 5 proj · 2 users" },
  { id: "business", name: "Business", price: 179, credits: 1500, label: "200 fat · 20 proj · 5 users" },
  { id: "pro", name: "Pro", price: 349, credits: 5000, label: "Ilimitado · 15 users" },
  { id: "enterprise", name: "Enterprise", price: 599, credits: 10000, label: "Custom · Ilimitado" },
]

type SuccessData = {
  tenant_id: string
  owner_email: string
  temp_password: string
}

export default function NovoClientePage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState<SuccessData | null>(null)
  const [copied, setCopied] = useState(false)

  // Empresa
  const [companyName, setCompanyName] = useState("")
  const [companyNif, setCompanyNif] = useState("")
  const [companyEmail, setCompanyEmail] = useState("")
  const [companyPhone, setCompanyPhone] = useState("")
  const [companyAddress, setCompanyAddress] = useState("")

  // Owner
  const [ownerName, setOwnerName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")

  // Plano
  const [plan, setPlan] = useState<TenantPlan>("starter")
  const [billing, setBilling] = useState<BillingCycle>("monthly")
  const [status, setStatus] = useState<"active" | "trial">("active")
  const [customCredits, setCustomCredits] = useState("")
  const [internalNotes, setInternalNotes] = useState("")

  const selectedPlan = PLANS.find((p) => p.id === plan) ?? PLANS[0]
  const annualPrice = selectedPlan.price * 10
  const annualSaving = selectedPlan.price * 2
  const defaultCredits =
    billing === "annual" ? selectedPlan.credits * 12 : selectedPlan.credits
  const creditsToUse = customCredits !== "" ? parseInt(customCredits, 10) || 0 : defaultCredits

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim() || !ownerName.trim() || !ownerEmail.trim()) {
      toast.error("Preenche os campos obrigatórios")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_nif: companyNif.trim() || null,
          company_email: companyEmail.trim() || null,
          company_phone: companyPhone.trim() || null,
          company_address: companyAddress.trim() || null,
          owner_name: ownerName.trim(),
          owner_email: ownerEmail.trim(),
          plan,
          billing_cycle: billing,
          status,
          initial_credits: customCredits !== "" ? creditsToUse : undefined,
          internal_notes: internalNotes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? `Erro ${res.status}`)
        return
      }
      setSuccess(json.data as SuccessData)
    } catch {
      toast.error("Erro de rede. Tenta de novo.")
    } finally {
      setBusy(false)
    }
  }

  async function copyCredentials() {
    if (!success) return
    const text = `URL: ${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/login\nEmail: ${success.owner_email}\nPassword: ${success.temp_password}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (success) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-lg mx-auto">
        <div className="flex flex-col items-center text-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Empresa criada</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Partilha estas credenciais com o cliente. A password temporária só é mostrada uma vez.
            </p>
          </div>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Credenciais de acesso
              <Button size="sm" variant="outline" onClick={copyCredentials}>
                {copied ? (
                  <><ClipboardCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />Copiado</>
                ) : (
                  <><Clipboard className="h-3.5 w-3.5 mr-1.5" />Copiar</>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 font-sans">Email</p>
              <p className="select-all">{success.owner_email}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 font-sans">Password temporária</p>
              <p className="select-all text-lg tracking-widest font-bold">{success.temp_password}</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mb-6">
          ID do tenant: <span className="font-mono">{success.tenant_id}</span>
        </p>

        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link href={`/admin/clientes/${success.tenant_id}`}>
              Ver detalhe
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" onClick={() => router.push("/admin/clientes")}>
            Lista de clientes
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <Link
          href="/admin/clientes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Clientes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
        <p className="text-muted-foreground text-sm">
          Cria a empresa e o utilizador owner. A password é gerada automaticamente.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Empresa */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="company_name">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Construções Silva Lda."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="company_nif">NIF</Label>
                <Input
                  id="company_nif"
                  value={companyNif}
                  onChange={(e) => setCompanyNif(e.target.value)}
                  placeholder="123456789"
                  maxLength={9}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company_phone">Telefone</Label>
                <Input
                  id="company_phone"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="+351 912 345 678"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_email">Email da empresa</Label>
              <Input
                id="company_email"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="geral@empresa.pt"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_address">Morada</Label>
              <Input
                id="company_address"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Rua Exemplo, 10, 1000-001 Lisboa"
              />
            </div>
          </CardContent>
        </Card>

        {/* Owner */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Responsável (owner)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="owner_name">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="owner_name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="João Silva"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner_email">
                Email de acesso <span className="text-destructive">*</span>
              </Label>
              <Input
                id="owner_email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="joao@empresa.pt"
                required
              />
              <p className="text-xs text-muted-foreground">
                Este email é usado para login. Deve ser único na plataforma.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Plano */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Plano e faturação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Ciclo */}
            <div className="flex rounded-lg border p-1 gap-1 w-fit">
              {(["monthly", "annual"] as BillingCycle[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBilling(c)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    billing === c
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c === "monthly" ? "Mensal" : "Anual"}
                  {c === "annual" && (
                    <Badge className="ml-1.5 text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">
                      -17%
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {/* Plano grid */}
            <div className="grid grid-cols-2 gap-2">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    plan === p.id
                      ? "border-foreground bg-muted/50 ring-1 ring-foreground"
                      : "hover:border-muted-foreground"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-sm">{p.name}</p>
                    {plan === p.id && (
                      <Check className="h-4 w-4 text-foreground shrink-0" />
                    )}
                  </div>
                  <p className="text-lg font-bold mt-0.5 tabular-nums">
                    {billing === "annual"
                      ? formatCurrency(p.price * 10)
                      : formatCurrency(p.price * 12)}
                    <span className="text-xs font-normal text-muted-foreground">/ano</span>
                  </p>
                  {billing === "annual" && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Poupa {formatCurrency(p.price * 2)}/ano
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{p.label}</p>
                </button>
              ))}
            </div>

            {billing === "annual" && (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                Faturação anual: <strong>{formatCurrency(annualPrice)}</strong> (poupa {formatCurrency(annualSaving)} vs mensal)
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="status">Estado inicial</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as "active" | "trial")}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="trial">Trial (14 dias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom_credits">
                  Créditos iniciais
                </Label>
                <Input
                  id="custom_credits"
                  type="number"
                  min={0}
                  value={customCredits}
                  onChange={(e) => setCustomCredits(e.target.value)}
                  placeholder={`${defaultCredits} (default)`}
                />
                <p className="text-xs text-muted-foreground">
                  Default: {defaultCredits.toLocaleString("pt-PT")} créditos
                  {billing === "annual" ? " (12 meses)" : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notas internas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              Notas internas
              <Badge variant="secondary" className="text-xs">só tu vês</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Contexto da venda, contacto de referência, condições especiais..."
              rows={3}
              className="resize-none"
            />
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card className="bg-muted/30">
          <CardContent className="pt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span>
              <span className="text-muted-foreground">Plano: </span>
              <strong>{selectedPlan.name} · {billing === "annual" ? "Anual" : "Mensal"}</strong>
            </span>
            <span>
              <span className="text-muted-foreground">Valor: </span>
              <strong>
                {billing === "annual"
                  ? `${formatCurrency(annualPrice)}/ano`
                  : `${formatCurrency(selectedPlan.price)}/mês`}
              </strong>
            </span>
            <span>
              <span className="text-muted-foreground">Créditos: </span>
              <strong>{creditsToUse.toLocaleString("pt-PT")}</strong>
            </span>
            <span>
              <span className="text-muted-foreground">Estado: </span>
              <strong>{status === "active" ? "Ativo" : "Trial 14 dias"}</strong>
            </span>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A criar...</>
            ) : (
              "Criar empresa e utilizador"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/admin/clientes")}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
