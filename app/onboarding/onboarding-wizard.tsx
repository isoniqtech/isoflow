"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Building2, Check, Landmark, Loader2, Plug, SkipForward } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { createClient } from "@/lib/supabase/client"
import { validateNIF } from "@/lib/utils/portugal"

type Tenant = {
  id: string
  name: string
  nif: string | null
  phone: string | null
  address: string | null
}

const companySchema = z.object({
  name: z.string().min(2, "Nome obrigatório").max(100),
  nif: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || validateNIF(v), "NIF inválido"),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
})

type CompanyValues = z.infer<typeof companySchema>

type ErpChoice = "toconline" | "primavera" | "atura" | "none"

const STEPS = [
  { id: 1, label: "Empresa", icon: Building2 },
  { id: 2, label: "Integração ERP", icon: Plug },
  { id: 3, label: "Banco", icon: Landmark },
] as const

export function OnboardingWizard({ tenant }: { tenant: Tenant }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [companyData, setCompanyData] = useState<CompanyValues>({
    name: tenant.name,
    nif: tenant.nif ?? "",
    phone: tenant.phone ?? "",
    address: tenant.address ?? "",
  })
  const [erpChoice, setErpChoice] = useState<ErpChoice>("none")

  const companyForm = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: companyData,
  })

  function handleCompanySubmit(values: CompanyValues) {
    setCompanyData(values)
    setStep(2)
  }

  function handleErpNext() {
    setStep(3)
  }

  async function finishOnboarding() {
    setSubmitting(true)
    const supabase = createClient()

    const { data: updated, error: tenantError } = await supabase
      .from("tenants")
      .update({
        name: companyData.name,
        nif: companyData.nif || null,
        phone: companyData.phone || null,
        address: companyData.address || null,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenant.id)
      .select("id, onboarding_completed")
      .maybeSingle()

    if (tenantError) {
      console.error("Onboarding finish — tenant update error:", tenantError)
      toast.error("Não foi possível guardar", {
        description: tenantError.message,
        duration: 10000,
      })
      setSubmitting(false)
      return
    }

    if (!updated || !updated.onboarding_completed) {
      console.error("Onboarding finish — update returned empty/incomplete:", updated)
      toast.error("Não foi possível guardar", {
        description:
          "A atualização não devolveu confirmação (RLS pode estar a bloquear). Recarrega e tenta de novo.",
        duration: 10000,
      })
      setSubmitting(false)
      return
    }

    if (erpChoice !== "none") {
      const { error: erpError } = await supabase
        .from("tenant_integrations")
        .insert({
          tenant_id: tenant.id,
          type: "erp",
          provider: erpChoice,
          is_active: false,
        })
      if (erpError) {
        console.warn("Onboarding finish — erp insert error:", erpError)
        toast.warning("Empresa guardada, mas a integração ERP falhou", {
          description: erpError.message,
          duration: 10000,
        })
      }
    }

    toast.success("Tudo pronto! Bem-vindo ao ISOFlow.")
    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-muted/40 py-12 px-4">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-display font-semibold tracking-tight">
            Vamos configurar a tua conta
          </h1>
          <p className="text-muted-foreground">
            Três passos rápidos. Podes saltar os opcionais.
          </p>
        </header>

        <Stepper current={step} />

        {step === 1 && (
          <Card className="shadow-[var(--shadow-card,none)] border-border/60">
            <CardHeader>
              <CardTitle>Dados da empresa</CardTitle>
              <CardDescription>
                Vamos usar estes dados nos teus relatórios e faturas.
              </CardDescription>
            </CardHeader>
            <Form {...companyForm}>
              <form
                onSubmit={companyForm.handleSubmit(handleCompanySubmit)}
                className="space-y-0"
              >
                <CardContent className="space-y-4">
                  <FormField
                    control={companyForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da empresa</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={companyForm.control}
                    name="nif"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIF</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="numeric"
                            maxLength={9}
                            placeholder="9 dígitos"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={companyForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input type="tel" autoComplete="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={companyForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Morada</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormDescription>
                          Aparece nos cabeçalhos dos relatórios.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button type="submit">Continuar</Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        )}

        {step === 2 && (
          <Card className="shadow-[var(--shadow-card,none)] border-border/60">
            <CardHeader>
              <CardTitle>Integração ERP</CardTitle>
              <CardDescription>
                Escolhe o ERP onde queres sincronizar as faturas. Podes
                configurar as credenciais depois nas Configurações.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={erpChoice}
                onValueChange={(v) => setErpChoice(v as ErpChoice)}
                className="grid gap-3"
              >
                <ErpOption value="toconline" label="Toconline" />
                <ErpOption value="primavera" label="Primavera" />
                <ErpOption value="atura" label="Atura" />
                <ErpOption value="none" label="Nenhum por agora" />
              </RadioGroup>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={handleErpNext}>Continuar</Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card className="shadow-[var(--shadow-card,none)] border-border/60">
            <CardHeader>
              <CardTitle>Ligar banco</CardTitle>
              <CardDescription>
                Liga uma conta bancária para conciliar movimentos com faturas
                automaticamente. Podes fazer isto depois.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                A integração com o banco usa Salt Edge (Open Banking europeu).
                Vais autenticar-te no portal do teu banco. Por agora podes
                saltar — adicionas depois em Configurações &gt; Integrações.
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={finishOnboarding}
                  disabled={submitting}
                >
                  <SkipForward className="mr-2 h-4 w-4" />
                  Saltar e terminar
                </Button>
                <Button disabled title="Em breve">
                  <Landmark className="mr-2 h-4 w-4" />
                  Ligar banco
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-between gap-2">
      {STEPS.map((s, idx) => {
        const isComplete = current > s.id
        const isCurrent = current === s.id
        const Icon = s.icon
        return (
          <li key={s.id} className="flex-1 flex items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-medium",
                isComplete && "border-primary text-white",
                isCurrent && "border-foreground",
                !isCurrent && !isComplete && "border-muted text-muted-foreground",
              )}
              style={isComplete ? { background: "linear-gradient(135deg, #4E7217, #3DAEAF)" } : undefined}
            >
              {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                "text-sm font-medium hidden sm:inline",
                !isCurrent && !isComplete && "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-2",
                  isComplete ? "bg-foreground" : "bg-muted",
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function ErpOption({ value, label }: { value: ErpChoice; label: string }) {
  return (
    <Label
      htmlFor={`erp-${value}`}
      className="flex items-center gap-3 rounded-md border p-4 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-muted/30"
    >
      <RadioGroupItem id={`erp-${value}`} value={value} />
      <span className="font-medium">{label}</span>
    </Label>
  )
}
