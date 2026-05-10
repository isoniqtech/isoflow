"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SupportTicketStatus } from "@/types"

export function TicketStatusControl({
  ticketId,
  status,
}: {
  ticketId: string
  status: SupportTicketStatus
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleChange(newStatus: string) {
    if (newStatus === status) return
    setBusy(true)
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha ao mudar estado", {
        description: errBody.error ?? `HTTP ${res.status}`,
      })
      setBusy(false)
      return
    }
    toast.success("Estado atualizado")
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      <Select value={status} onValueChange={handleChange} disabled={busy}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Aberto</SelectItem>
          <SelectItem value="in_progress">Em curso</SelectItem>
          <SelectItem value="waiting_client">À espera do cliente</SelectItem>
          <SelectItem value="resolved">Resolvido</SelectItem>
          <SelectItem value="closed">Fechado</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
