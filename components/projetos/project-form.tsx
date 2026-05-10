"use client"

import { useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Label } from "@/components/ui/label"

const formSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(100),
  code: z.string().trim().max(50),
  type: z.enum(["obra", "projeto", "departamento", "cliente", "outro"]),
  status: z.enum(["active", "completed", "paused", "cancelled"]),
  description: z.string().trim().max(2000),
  budget: z.string().trim(),
  budget_alert_threshold: z
    .string()
    .trim()
    .regex(/^\d+$/, "Apenas números")
    .refine((v) => Number(v) >= 0 && Number(v) <= 200, "Entre 0 e 200"),
  start_date: z.string().trim(),
  end_date: z.string().trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  client_name: z.string().trim().max(200),
  location: z.string().trim().max(200),
  notes: z.string().trim().max(5000),
})

type FormValues = z.infer<typeof formSchema>

export type ProjectFormDefaults = Partial<FormValues> & { aliases?: string[] }

export function ProjectForm({
  mode = "create",
  projectId,
  defaults,
}: {
  mode?: "create" | "edit"
  projectId?: string
  defaults?: ProjectFormDefaults
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [aliases, setAliases] = useState<string[]>(defaults?.aliases ?? [])
  const [aliasInput, setAliasInput] = useState("")

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaults?.name ?? "",
      code: defaults?.code ?? "",
      type: defaults?.type ?? "obra",
      status: defaults?.status ?? "active",
      description: defaults?.description ?? "",
      budget: defaults?.budget ?? "",
      budget_alert_threshold: defaults?.budget_alert_threshold ?? "80",
      start_date: defaults?.start_date ?? "",
      end_date: defaults?.end_date ?? "",
      color: defaults?.color ?? "#2563EB",
      client_name: defaults?.client_name ?? "",
      location: defaults?.location ?? "",
      notes: defaults?.notes ?? "",
    },
  })

  function addAlias() {
    const v = aliasInput.trim().toLowerCase()
    if (!v) return
    if (aliases.length >= 20) {
      toast.warning("Máximo 20 aliases por projeto")
      return
    }
    if (aliases.includes(v)) {
      setAliasInput("")
      return
    }
    setAliases([...aliases, v])
    setAliasInput("")
  }

  function removeAlias(a: string) {
    setAliases(aliases.filter((x) => x !== a))
  }

  function handleAliasKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addAlias()
    } else if (e.key === "Backspace" && aliasInput === "" && aliases.length > 0) {
      setAliases(aliases.slice(0, -1))
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const payload = {
      name: values.name,
      code: values.code || null,
      type: values.type,
      status: values.status,
      description: values.description || null,
      budget: values.budget ? Number(values.budget) : null,
      budget_alert_threshold: Number(values.budget_alert_threshold),
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      color: values.color,
      client_name: values.client_name || null,
      location: values.location || null,
      notes: values.notes || null,
      name_aliases: aliases,
    }

    const url = mode === "edit" && projectId ? `/api/projetos/${projectId}` : "/api/projetos"
    const method = mode === "edit" ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: "Erro desconhecido" }))
      console.error("Project form submit failed:", res.status, errBody, payload)
      let description = errBody.error ?? `HTTP ${res.status}`
      if (errBody.details?.fieldErrors) {
        const fieldMessages = Object.entries(errBody.details.fieldErrors)
          .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
          .join(" · ")
        if (fieldMessages) description = fieldMessages
      }
      toast.error(mode === "edit" ? "Falha ao guardar" : "Falha ao criar projeto", {
        description,
        duration: 12000,
      })
      setSubmitting(false)
      return
    }

    const { data } = await res.json()
    toast.success(mode === "edit" ? "Projeto atualizado" : "Projeto criado")
    router.push(`/projetos/${data.id}`)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Obra Setúbal — Moradia 2" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Auto se vazio" />
                </FormControl>
                <FormDescription>
                  Gerado automaticamente se deixares vazio (ex: OB-2026-001).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="obra">Obra</SelectItem>
                    <SelectItem value="projeto">Projeto</SelectItem>
                    <SelectItem value="departamento">Departamento</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cor</FormLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-10 w-14 rounded-md border cursor-pointer"
                  />
                  <FormControl>
                    <Input {...field} className="font-mono" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="budget"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Orçamento (€)</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="budget_alert_threshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alerta (% orçamento)</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" {...field} />
                </FormControl>
                <FormDescription>Default 80%</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="client_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente / dono</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data início</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data fim</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Localização</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="aliases-input">Aliases (matching automático)</Label>
          <div className="rounded-md border bg-background min-h-10 px-3 py-2 flex flex-wrap gap-1.5 items-center focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            {aliases.map((a) => (
              <Badge key={a} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
                {a}
                <button
                  type="button"
                  onClick={() => removeAlias(a)}
                  className="hover:bg-muted rounded p-0.5"
                  aria-label={`Remover ${a}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              id="aliases-input"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              onKeyDown={handleAliasKey}
              onBlur={addAlias}
              className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
              placeholder={
                aliases.length === 0 ? "Ex: obra1, ob1, moradia setúbal" : ""
              }
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Termos que o sistema usa para associar faturas automaticamente
            quando recebes via WhatsApp ou email. Enter ou vírgula para
            adicionar.
          </p>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas internas</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Guardar alterações" : "Criar projeto"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
