"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileDown, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar projeto?</AlertDialogTitle>
              <AlertDialogDescription>
                Vais apagar permanentemente o projeto <strong>{projectName}</strong>.
                As faturas associadas ficam sem projeto (não são apagadas).
                Esta ação é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "A apagar..." : "Apagar projeto"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
