"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { AlertTriangle, Coins, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(200),
  description: z.string().trim().min(10, "Descreve com mais detalhe").max(5000),
  category: z.string().trim(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
})

type FormValues = z.infer<typeof formSchema>

const COSTS = { normal: 5, urgent: 10 }

export function TicketForm({ creditsBalance }: { creditsBalance: number }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      priority: "medium",
    },
  })

  const priority = form.watch("priority")
  const cost = priority === "urgent" ? COSTS.urgent : COSTS.normal
  const insufficient = creditsBalance < cost

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const payload = {
      title: values.title,
      description: values.description,
      category: values.category || null,
      priority: values.priority,
    }
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error("Ticket create failed:", res.status, errBody)
      toast.error("Falha ao abrir ticket", {
        description: errBody.error ?? `HTTP ${res.status}`,
        duration: 10000,
      })
      setSubmitting(false)
      return
    }
    const { data } = await res.json()
    toast.success("Ticket criado", {
      description: `Debitados ${cost} créditos.`,
    })
    router.push(`/suporte/${data.id}`)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Erro ao processar fatura"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select
                  value={field.value || "__none"}
                  onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none">Outra</SelectItem>
                    <SelectItem value="billing">Faturação</SelectItem>
                    <SelectItem value="technical">Técnico</SelectItem>
                    <SelectItem value="integration">Integração</SelectItem>
                    <SelectItem value="invoice">Fatura</SelectItem>
                    <SelectItem value="banking">Banco</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prioridade</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente (+5 créditos)</SelectItem>
                  </SelectContent>
                </Select>
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
                <Textarea
                  rows={6}
                  placeholder="Descreve o problema com o máximo de detalhe..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div
          className={cn(
            "rounded-md border p-3 flex items-start gap-3",
            insufficient
              ? "border-destructive/40 bg-destructive/5"
              : "bg-muted/30",
          )}
        >
          {insufficient ? (
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
          ) : (
            <Coins className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          )}
          <div className="text-sm flex-1">
            <p className={cn("font-medium", insufficient && "text-destructive")}>
              Custo: {cost} créditos · Saldo atual: {creditsBalance.toLocaleString("pt-PT")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {insufficient
                ? "Não tens créditos suficientes. Recarrega em Plano para abrir o ticket."
                : priority === "urgent"
                  ? "Tickets urgentes custam 10 créditos. Tempo de resposta < 4h."
                  : "Tickets normais custam 5 créditos. Tempo de resposta < 24h em dias úteis."}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || insufficient}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Abrir ticket ({cost} créditos)
          </Button>
        </div>
      </form>
    </Form>
  )
}
