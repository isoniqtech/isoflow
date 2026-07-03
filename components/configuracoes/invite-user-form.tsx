"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({
  name: z.string().min(2, "Nome obrigatorio"),
  email: z.string().email("Email invalido"),
  role: z.enum(["owner", "admin", "accountant", "member", "investidor"]),
  capital_disponivel: z.number().min(0).optional(),
  tipo_negocio: z.array(z.enum(["terreno", "casa", "edificio"])).optional(),
})

type FormData = z.infer<typeof schema>

const ROLE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  owner: {
    label: "Owner",
    description: "Acesso total. Gere utilizadores, projetos, subscricao, pagamentos e todas as integracoes.",
  },
  admin: {
    label: "Admin",
    description: "Gere faturas, projetos e utilizadores. Pode convidar membros e criar projetos. Nao gere subscricao nem integracoes bancarias.",
  },
  accountant: {
    label: "Contabilista",
    description: "Ve faturas, valores, conciliacao bancaria e exporta relatorios. Nao gere utilizadores nem configuracoes.",
  },
  member: {
    label: "Membro",
    description: "Envia faturas (upload, WhatsApp ou email). Ve apenas as suas proprias faturas e os projetos a que foi atribuido.",
  },
  investidor: {
    label: "Investidor",
    description: "Acesso restrito ao portal de investidor. Ve apenas os projetos em que participa e os respetivos relatorios.",
  },
}

const TIPO_OPTIONS: Array<{ value: "terreno" | "casa" | "edificio"; label: string }> = [
  { value: "terreno", label: "Terreno" },
  { value: "casa", label: "Casa" },
  { value: "edificio", label: "Edificio" },
]

export function InviteUserForm() {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "member", tipo_negocio: [] },
  })

  const role = watch("role")
  const tipoNegocio = watch("tipo_negocio") ?? []
  const isInvestidor = role === "investidor"

  function toggleTipo(val: "terreno" | "casa" | "edificio") {
    const current = tipoNegocio
    const next = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val]
    setValue("tipo_negocio", next)
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const res = await fetch("/api/utilizadores/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = err.error ?? "Erro ao enviar convite"
        setServerError(msg)
        toast.error(msg)
        return
      }

      toast.success(`Convite enviado para ${data.email}`)
      reset({ role: "member", tipo_negocio: [] })
      setOpen(false)
      router.refresh()
    } catch {
      setServerError("Erro de ligacao ao servidor")
      toast.error("Erro de ligacao ao servidor")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar utilizador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar utilizador</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register("name")} placeholder="Nome completo" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="email@empresa.pt" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setValue("role", v as FormData["role"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_DESCRIPTIONS).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role && ROLE_DESCRIPTIONS[role] && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                {ROLE_DESCRIPTIONS[role].description}
              </p>
            )}
          </div>

          {isInvestidor && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Dados do investidor</p>

              <div className="space-y-1.5">
                <Label htmlFor="capital">Capital disponivel (EUR)</Label>
                <Input
                  id="capital"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  {...register("capital_disponivel", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de negocio preferido</Label>
                <div className="flex gap-4">
                  {TIPO_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`tipo-${opt.value}`}
                        checked={tipoNegocio.includes(opt.value)}
                        onCheckedChange={() => toggleTipo(opt.value)}
                      />
                      <Label htmlFor={`tipo-${opt.value}`} className="font-normal cursor-pointer text-sm">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            O utilizador vai receber um email com link para definir a password e entrar na app.
          </p>

          {serverError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {serverError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar convite
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
