"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Save, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils/portugal"
import type { InvestidorEstado, TipoNegocio } from "@/types"

const schema = z.object({
  capital_disponivel: z.number().min(0, "Valor deve ser >= 0"),
  tipo_negocio: z.array(z.enum(["terreno", "casa", "edificio"])),
  estado: z.enum(["pronto_para_investir", "nao_disponivel"]),
  notas: z.string().max(2000).optional(),
})

type FormData = z.infer<typeof schema>

const ESTADO_LABELS: Partial<Record<InvestidorEstado, string>> = {
  pronto_para_investir: "Pronto para investir",
  nao_disponivel: "Nao disponivel",
}

const TIPO_OPTIONS: { value: TipoNegocio; label: string }[] = [
  { value: "terreno", label: "Terreno" },
  { value: "casa", label: "Casa" },
  { value: "edificio", label: "Edificio" },
]

type ProfileData = {
  id: string
  nome: string
  email: string
  estado: InvestidorEstado
  capital_disponivel: number
  capital_alocado: number
  tipo_negocio: TipoNegocio[]
  notas: string | null
}

export function InvestorProfileForm({ profile }: { profile: ProfileData }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      capital_disponivel: profile.capital_disponivel,
      tipo_negocio: profile.tipo_negocio,
      estado: profile.estado === "em_investimento" ? "pronto_para_investir" : profile.estado,
      notas: profile.notas ?? "",
    },
  })

  const tipoNegocio = watch("tipo_negocio")
  const capitalAtual = watch("capital_disponivel")

  async function onSubmit(data: FormData) {
    setSaving(true)
    try {
      const res = await fetch("/api/investidor/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro ao guardar")
      toast.success("Perfil atualizado")
      router.refresh()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Resumo financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Capital disponivel</span>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(capitalAtual ?? profile.capital_disponivel)}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Alocado em projetos</span>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {formatCurrency(profile.capital_alocado)}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total (disponivel + alocado)</span>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency((capitalAtual ?? profile.capital_disponivel) + profile.capital_alocado)}
          </p>
        </div>
      </div>

      {/* Dados pessoais (read-only) */}
      <div className="rounded-lg border bg-background p-4 space-y-3">
        <h2 className="text-sm font-semibold">Dados pessoais</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <p className="mt-1 text-sm font-medium">{profile.nome}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="mt-1 text-sm font-medium">{profile.email}</p>
          </div>
        </div>
      </div>

      {/* Campos editaveis */}
      <div className="rounded-lg border bg-background p-4 space-y-5">
        <h2 className="text-sm font-semibold">Preferencias de investimento</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="capital_disponivel">Capital disponivel (€)</Label>
            <Input
              id="capital_disponivel"
              type="number"
              min="0"
              step="1000"
              {...register("capital_disponivel", { valueAsNumber: true })}
              className={errors.capital_disponivel ? "border-destructive" : ""}
            />
            {errors.capital_disponivel && (
              <p className="text-xs text-destructive">{errors.capital_disponivel.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Valor que tem disponivel para novos investimentos. Os projetos a que foi associado sao descontados automaticamente.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select
              defaultValue={profile.estado === "em_investimento" ? "pronto_para_investir" : profile.estado}
              onValueChange={(v) => setValue("estado", v as "pronto_para_investir" | "nao_disponivel", { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ESTADO_LABELS) as [InvestidorEstado, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tipo de negocio preferido</Label>
          <div className="flex flex-wrap gap-4">
            {TIPO_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`tipo-${opt.value}`}
                  checked={tipoNegocio.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...tipoNegocio, opt.value]
                      : tipoNegocio.filter((t) => t !== opt.value)
                    setValue("tipo_negocio", next, { shouldDirty: true })
                  }}
                />
                <Label htmlFor={`tipo-${opt.value}`} className="cursor-pointer font-normal">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notas">Notas</Label>
          <Textarea
            id="notas"
            rows={3}
            placeholder="Observacoes, preferencias ou outras informacoes..."
            {...register("notas")}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !isDirty}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "A guardar..." : "Guardar alteracoes"}
        </Button>
      </div>
    </form>
  )
}
