"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileDown, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const CONFIRM_WORD = "irreversível"

export function ProjectActions({
  projectId,
  projectName,
  canEdit,
  canDelete,
  canExportReport,
}: {
  projectId: string
  projectName: string
  canEdit: boolean
  canDelete: boolean
  canExportReport: boolean
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const confirmed = confirmText === CONFIRM_WORD

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/projetos/${projectId}`, { method: "DELETE" })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha ao apagar projeto", {
        description: errBody.error ?? `HTTP ${res.status}`,
        duration: 8000,
      })
      setDeleting(false)
      return
    }
    toast.success("Projeto apagado")
    router.push("/projetos")
    router.refresh()
  }

  if (!canEdit && !canDelete && !canExportReport) return null

  return (
    <div className="flex items-center gap-2">
      {canExportReport && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/api/projetos/${projectId}/relatorio`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileDown className="mr-2 h-4 w-4" />
            Relatório PDF
          </a>
        </Button>
      )}
      {canEdit && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projetos/${projectId}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      )}
      {canDelete && (
        <AlertDialog onOpenChange={(open) => { if (!open) setConfirmText("") }}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar projeto?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Vais apagar permanentemente o projeto <strong>{projectName}</strong>.
                    As faturas associadas ficam sem projeto. Esta ação é irreversível.
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-sm">
                      Escreve <strong className="font-mono">{CONFIRM_WORD}</strong> para confirmar:
                    </p>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && confirmed) handleDelete() }}
                      placeholder={CONFIRM_WORD}
                      autoComplete="off"
                      className="font-mono"
                    />
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                onClick={handleDelete}
                disabled={!confirmed || deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "A apagar..." : "Apagar projeto"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
