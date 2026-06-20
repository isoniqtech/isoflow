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
  role: z.enum(["admin", "accountant", "member"]),
})

type FormData = z.infer<typeof schema>

const ROLE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  admin: {
    label: "Admin",
    description: "Gere faturas, projetos e utilizadores. Pode convidar membros e criar projetos. Nao gere subscrição nem integracoes bancarias.",
  },
  accountant: {
    label: "Contabilista",
    description: "Ve faturas, valores, conciliacao bancaria e exporta relatorios. Nao gere utilizadores nem configuracoes.",
  },
  member: {
    label: "Membro",
    description: "Envia faturas (upload, WhatsApp ou email). Ve apenas as suas proprias faturas e os projetos a que foi atribuido.",
  },
}

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
    defaultValues: { role: "member" },
  })

  const role = watch("role")

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
      reset()
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
