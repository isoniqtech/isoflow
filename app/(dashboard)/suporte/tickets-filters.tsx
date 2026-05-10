"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types"

export function TicketsFilters({
  status,
  priority,
  category,
}: {
  status: SupportTicketStatus | "all"
  priority: SupportTicketPriority | "all"
  category: SupportTicketCategory | "all"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === "all") next.delete(key)
    else next.set(key, value)
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`)
    })
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-pending={isPending || undefined}
    >
      <Select value={status} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os estados</SelectItem>
          <SelectItem value="open">Aberto</SelectItem>
          <SelectItem value="in_progress">Em curso</SelectItem>
          <SelectItem value="waiting_client">À espera do cliente</SelectItem>
          <SelectItem value="resolved">Resolvido</SelectItem>
          <SelectItem value="closed">Fechado</SelectItem>
        </SelectContent>
      </Select>

      <Select value={priority} onValueChange={(v) => setParam("priority", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as prioridades</SelectItem>
          <SelectItem value="urgent">Urgente</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="medium">Média</SelectItem>
          <SelectItem value="low">Baixa</SelectItem>
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={(v) => setParam("category", v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as categorias</SelectItem>
          <SelectItem value="billing">Faturação</SelectItem>
          <SelectItem value="technical">Técnico</SelectItem>
          <SelectItem value="integration">Integração</SelectItem>
          <SelectItem value="invoice">Fatura</SelectItem>
          <SelectItem value="banking">Banco</SelectItem>
          <SelectItem value="other">Outro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
