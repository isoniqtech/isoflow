"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Trash2,
  XCircle,
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
}: {
  invoiceId: string
  status: InvoiceStatus
  canEdit: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
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

  if (!canEdit && !canDelete) return null

  const canMarkPaid = canEdit && status !== "paid" && status !== "rejected"
  const canMarkRejected = canEdit && status !== "rejected"

  return (
    <div className="flex items-center gap-2">
      {canMarkPaid && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => changeStatus("paid")}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Marcar como paga
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
              onClick={() => changeStatus("pending")}
              disabled={busy}
              className="cursor-pointer"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Reabrir (pendente)
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
