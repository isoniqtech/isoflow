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
  role: z.enum(["owner", "admin", "accountant", "member"]),
  password: z.string().min(6, "Minimo 6 caracteres"),
})

type FormData = z.infer<typeof schema>

const ROLE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  owner: {
    label: "Owner",
    description: "Acesso total ao tenant. Gere utilizadores, projetos, subscrição, pagamentos e todas as integracoes.",
  },
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

export function CreateUserForm({
  tenantId,
  onCreated,
}: {
  tenantId: string
  onCreated?: () => void
}) {
  const [open, setOpen] = useState(false)
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
    const res = await fetch(`/api/admin/tenants/${tenantId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Erro ao criar utilizador")
      return
    }

    toast.success("Utilizador criado com sucesso")
    reset()
    setOpen(false)
    router.refresh()
    onCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Novo utilizador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar utilizador</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register("name")} placeholder="Nome completo" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="email@empresa.pt" />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
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

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              placeholder="Minimo 6 caracteres"
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
