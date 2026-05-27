"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Send,
  Trash2,
  XCircle,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { InvoiceStatus } from "@/types"

export function InvoiceActions({
  invoiceId,
  status,
  canEdit,
  canDelete,
  erpSynced,
}: {
  invoiceId: string
  status: InvoiceStatus
  canEdit: boolean
  canDelete: boolean
  erpSynced?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function changeStatus(newStatus: InvoiceStatus) {
    setBusy(true)
    const res = await fetch(`/api/faturas/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha ao atualizar estado", {
        description: errBody.error ?? `HTTP ${res.status}`,
      })
      setBusy(false)
      return
    }
    toast.success("Estado atualizado")
    setBusy(false)
    router.refresh()
  }

  async function handleResendErp() {
    setResending(true)
    try {
      const res = await fetch(`/api/faturas/${invoiceId}/resend-erp`, {
        method: "POST",
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.ok) {
        toast.success(`Enviada para ERP (HTTP ${body.status ?? 200})`)
        router.refresh()
      } else {
        toast.error("Falha ao re-enviar para ERP", {
          description:
            body.error ?? `HTTP ${res.status}${body.status ? ` · resposta ${body.status}` : ""}`,
          duration: 12000,
        })
      }
    } catch (e) {
      toast.error("Erro a contactar o servidor", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setResending(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    const res = await fetch(`/api/faturas/${invoiceId}`, { method: "DELETE" })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha ao apagar fatura", {
        description: errBody.error ?? `HTTP ${res.status}`,
      })
      setBusy(false)
      return
    }
    toast.success("Fatura apagada")
    router.push("/faturas")
    router.refresh()
  }

  async function handleReviewOk() {
    setBusy(true)
    const res = await fetch(`/api/faturas/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "em_sistema", needs_review: false }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha ao atualizar estado", { description: errBody.error ?? `HTTP ${res.status}` })
      setBusy(false)
      return
    }
    toast.success("Fatura revista — volta a Em Sistema")
    setBusy(false)
    router.refresh()
  }

  if (!canEdit && !canDelete) return null

  const needsReview = status === "necessita_revisao"
  const canMarkRejected = canEdit && status !== "rejected"

  return (
    <div className="flex items-center gap-2">
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResendErp}
          disabled={resending}
        >
          {resending
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : erpSynced ? <RefreshCw className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />
          }
          {erpSynced ? "Re-enviar ao ERP" : "Enviar ao ERP"}
        </Button>
      )}
      {needsReview && canEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleReviewOk}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Fatura corrigida
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canMarkRejected && (
            <DropdownMenuItem
              onClick={() => changeStatus("rejected")}
              disabled={busy}
              className="cursor-pointer"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Marcar como rejeitada
            </DropdownMenuItem>
          )}
          {canEdit && status === "rejected" && (
            <DropdownMenuItem
              onClick={() => changeStatus("em_sistema")}
              disabled={busy}
              className="cursor-pointer"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Reabrir
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Apagar fatura
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar fatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Para conservar o histórico, considera
              marcar como rejeitada em vez de apagar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "A apagar..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
