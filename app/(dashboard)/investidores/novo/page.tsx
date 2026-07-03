"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const Schema = z.object({
  nome: z.string().min(2, "Nome obrigatorio"),
  email: z.string().email("Email invalido"),
  estado: z.enum(["pronto_para_investir", "nao_disponivel"]),
  capital_disponivel: z.number().min(0, "Valor invalido"),
  tipo_negocio: z.array(z.enum(["terreno", "casa", "edificio"])).min(1, "Seleciona pelo menos um tipo"),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof Schema>

const TIPO_OPTIONS: Array<{ value: "terreno" | "casa" | "edificio"; label: string }> = [
  { value: "terreno", label: "Terreno" },
  { value: "casa", label: "Casa" },
  { value: "edificio", label: "Edificio" },
]

export default function NovoInvestidorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: {
      estado: "pronto_para_investir",
      capital_disponivel: 0,
      tipo_negocio: [],
    },
  })

  const tipoNegocio = watch("tipo_negocio")
  const estadoValue = watch("estado")

  function toggleTipo(val: "terreno" | "casa" | "edificio") {
    const current = tipoNegocio ?? []
    const next = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val]
    setValue("tipo_negocio", next, { shouldValidate: true })
  }

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch("/api/investidores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro ao criar")
      toast.success("Investidor criado")
      router.push(`/investidores/${json.id}`)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <Link
          href="/investidores"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar a investidores
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Novo investidor</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do investidor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" {...register("nome")} placeholder="Nome completo" />
                {errors.nome && (
                  <p className="text-xs text-destructive">{errors.nome.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} placeholder="email@exemplo.com" />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={estadoValue}
                  onValueChange={(v) =>
                    setValue("estado", v as FormData["estado"], { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pronto_para_investir">Pronto para investir</SelectItem>
                    <SelectItem value="nao_disponivel">Nao disponivel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="capital">Capital disponivel (EUR)</Label>
                <Input
                  id="capital"
                  type="number"
                  min="0"
                  step="1000"
                  {...register("capital_disponivel", { valueAsNumber: true })}
                  placeholder="0"
                />
                {errors.capital_disponivel && (
                  <p className="text-xs text-destructive">{errors.capital_disponivel.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de negocio preferido</Label>
              <div className="flex gap-4">
                {TIPO_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`tipo-${opt.value}`}
                      checked={(tipoNegocio ?? []).includes(opt.value)}
                      onCheckedChange={() => toggleTipo(opt.value)}
                    />
                    <Label htmlFor={`tipo-${opt.value}`} className="font-normal cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </div>
              {errors.tipo_negocio && (
                <p className="text-xs text-destructive">{errors.tipo_negocio.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                {...register("notas")}
                placeholder="Notas internas sobre o investidor"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "A criar..." : "Criar investidor"}
              </Button>
              <Link href="/investidores">
                <Button variant="outline" type="button">Cancelar</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
