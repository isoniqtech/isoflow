"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, CheckCircle2, Loader2, MoreHorizontal, Send, Trash2, XCircle } from "lucide-react"
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
  needsReview: needsReviewFlag,
}: {
  invoiceId: string
  status: InvoiceStatus
  canEdit: boolean
  canDelete: boolean
  erpSynced?: boolean
  /** Flag booleana needs_review (pode divergir do status). */
  needsReview?: boolean
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
      // create-fc trata os dois modos (toconline_direct e n8n), leva a
      // categoria de gasto e faz dedup. O resend-erp antigo so' servia n8n.
      const res = await fetch("/api/faturas/create-fc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoice_ids: [invoiceId] }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error("Falha ao enviar para ERP", {
          description: body.error ?? `HTTP ${res.status}`,
          duration: 12000,
        })
        return
      }

      const erros: string[] = body.errors ?? []
      if (erros.length > 0) {
        toast.error("Falha ao enviar para ERP", {
          description: erros[0],
          duration: 12000,
        })
      } else if (body.queued > 0) {
        toast.success("Fatura enviada para o ERP")
        router.refresh()
      } else if (body.skipped > 0) {
        toast.info("Já estava lançada no ERP", {
          description: "Nada foi enviado de novo.",
        })
        router.refresh()
      } else {
        toast.success("Pedido enviado ao ERP")
        router.refresh()
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
        description: errBody.details ?? errBody.error ?? `HTTP ${res.status}`,
        duration: 10000,
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
    // So repor "em_sistema" quando o estado e' mesmo de revisao; caso contrario
    // apenas limpar a flag, sem pisar o estado atual.
    const payload =
      status === "necessita_revisao"
        ? { status: "em_sistema", needs_review: false }
        : { needs_review: false }
    const res = await fetch(`/api/faturas/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  // Mostrar "Fatura corrigida" quando ha revisao por resolver - seja pelo estado
  // (necessita_revisao) seja pela flag booleana needs_review (podem divergir: o
  // banner do detalhe usa a flag, por isso o botao tem de a respeitar tambem).
  const needsReview = status === "necessita_revisao" || needsReviewFlag === true
  const canMarkRejected = canEdit && status !== "rejected"

  return (
    <div className="flex items-center gap-2">
      {/* Ja' lancada no ERP: nao se reenvia (criaria duplicado / divergencia) */}
      {canEdit && erpSynced && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          Lançada no ERP
        </span>
      )}
      {canEdit && !erpSynced && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResendErp}
          disabled={resending}
        >
          {resending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Enviar ao ERP
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
