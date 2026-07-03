"use client"

import { useEffect, useState, useTransition } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft,
  Mail,
  Pencil,
  Save,
  X,
  UserCheck,
  FileDown,
  Loader2,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils/portugal"
import type { InvestidorDetail } from "@/lib/queries/investidores"
import type { InvestidorEstado, TipoNegocio } from "@/types"

const ESTADO_LABELS: Record<InvestidorEstado, string> = {
  pronto_para_investir: "Pronto para investir",
  em_investimento: "Em investimento",
  nao_disponivel: "Nao disponivel",
}

const ESTADO_CLASSES: Record<InvestidorEstado, string> = {
  pronto_para_investir:
    "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  em_investimento:
    "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  nao_disponivel:
    "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
}

const TIPO_OPTIONS: Array<{ value: TipoNegocio; label: string }> = [
  { value: "terreno", label: "Terreno" },
  { value: "casa", label: "Casa" },
  { value: "edificio", label: "Edificio" },
]

const UpdateSchema = z.object({
  nome: z.string().min(2, "Nome obrigatorio"),
  email: z.string().email("Email invalido"),
  estado: z.enum(["pronto_para_investir", "em_investimento", "nao_disponivel"]),
  capital_disponivel: z.number().min(0),
  tipo_negocio: z.array(z.enum(["terreno", "casa", "edificio"])),
  notas: z.string().optional().nullable(),
})

type FormData = z.infer<typeof UpdateSchema>

export default function InvestidorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [data, setData] = useState<InvestidorDetail | null>(null)
  const [fetching, setFetching] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(UpdateSchema) })

  const tipoNegocio = watch("tipo_negocio") ?? []
  const estadoValue = watch("estado")

  useEffect(() => {
    fetch(`/api/investidores/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        reset({
          nome: d.nome,
          email: d.email,
          estado: d.estado,
          capital_disponivel: d.capital_disponivel,
          tipo_negocio: d.tipo_negocio,
          notas: d.notas ?? "",
        })
      })
      .catch(() => toast.error("Erro ao carregar investidor"))
      .finally(() => setFetching(false))
  }, [id, reset])

  function toggleTipo(val: TipoNegocio) {
    const current = tipoNegocio
    const next = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val]
    setValue("tipo_negocio", next, { shouldValidate: true })
  }

  async function onSave(formData: FormData) {
    setSaving(true)
    try {
      const res = await fetch(`/api/investidores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error("Erro ao guardar")
      toast.success("Guardado")
      setEditing(false)
      const updated = await fetch(`/api/investidores/${id}`).then((r) => r.json())
      setData(updated)
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function sendInvite() {
    setInviting(true)
    try {
      const res = await fetch(`/api/investidores/${id}/invite`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      toast.success("Convite enviado")
      const updated = await fetch(`/api/investidores/${id}`).then((r) => r.json())
      setData(updated)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setInviting(false)
    }
  }

  async function downloadReport() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/investidores/${id}/relatorio`)
      if (!res.ok) throw new Error("Erro ao gerar relatorio")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `investidor-${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  if (fetching) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Investidor nao encontrado.
      </div>
    )
  }

  const totalCapitalAlocado = data.projetos.reduce(
    (s, p) => s + (p.valor_estimado ?? 0),
    0,
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/investidores"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar a investidores
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.nome}</h1>
            <p className="text-sm text-muted-foreground">{data.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadReport}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Relatorio PDF
            </Button>
            {!data.user_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={sendInvite}
                disabled={inviting}
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Enviar convite
              </Button>
            )}
            {!editing ? (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  reset({
                    nome: data.nome,
                    email: data.email,
                    estado: data.estado,
                    capital_disponivel: data.capital_disponivel,
                    tipo_negocio: data.tipo_negocio,
                    notas: data.notas ?? "",
                  })
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Estado</p>
            <Badge variant="outline" className={`mt-1 ${ESTADO_CLASSES[data.estado]}`}>
              {ESTADO_LABELS[data.estado]}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Capital disponivel</p>
            <p className="text-lg font-semibold tabular-nums mt-1">
              {formatCurrency(data.capital_disponivel)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Capital alocado</p>
            <p className="text-lg font-semibold tabular-nums mt-1">
              {formatCurrency(totalCapitalAlocado)}
            </p>
            <p className="text-xs text-muted-foreground">{data.projetos.length} projetos</p>
          </CardContent>
        </Card>
      </div>

      {data.user_id && (
        <div className="flex items-center gap-2 rounded-lg border bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/40 px-4 py-2">
          <UserCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            Investidor com acesso ao portal.
          </p>
        </div>
      )}

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar dados</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSave)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input {...register("nome")} />
                  {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select
                    value={estadoValue}
                    onValueChange={(v) => setValue("estado", v as FormData["estado"], { shouldValidate: true })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pronto_para_investir">Pronto para investir</SelectItem>
                      <SelectItem value="em_investimento">Em investimento</SelectItem>
                      <SelectItem value="nao_disponivel">Nao disponivel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Capital disponivel (EUR)</Label>
                  <Input type="number" min="0" step="1000" {...register("capital_disponivel", { valueAsNumber: true })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo de negocio</Label>
                <div className="flex gap-4">
                  {TIPO_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-tipo-${opt.value}`}
                        checked={tipoNegocio.includes(opt.value)}
                        onCheckedChange={() => toggleTipo(opt.value)}
                      />
                      <Label htmlFor={`edit-tipo-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notas</Label>
                <Textarea {...register("notas")} rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        data.notas && (
          <Card>
            <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{data.notas}</p>
            </CardContent>
          </Card>
        )
      )}

      {data.projetos.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Projetos</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Projeto</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Orcamento</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">%</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Valor estimado</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Gasto total</th>
                </tr>
              </thead>
              <tbody>
                {data.projetos.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/projetos/${p.id}`} className="font-medium hover:underline flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        {p.nome}
                        {p.code && <span className="text-xs text-muted-foreground font-mono">{p.code}</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.budget !== null ? formatCurrency(p.budget) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.percentagem}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.valor_estimado !== null ? formatCurrency(p.valor_estimado) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(p.total_gasto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.projetos.length > 0 && (
              <>
                <Separator />
                <div className="px-4 py-3 flex justify-end">
                  <span className="text-sm font-medium">
                    Total alocado: {formatCurrency(totalCapitalAlocado)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
