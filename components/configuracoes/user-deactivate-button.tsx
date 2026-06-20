"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UserX } from "lucide-react"
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

export function UserDeactivateButton({
  userId,
  userName,
}: {
  userId: string
  userName: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDeactivate() {
    setLoading(true)
    const res = await fetch(`/api/utilizadores/${userId}`, { method: "DELETE" })
    if (res.ok) {
      toast.success(`${userName} desativado`)
      router.refresh()
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Erro ao desativar")
    }
    setLoading(false)
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-7 px-2">
          <UserX className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar utilizador</AlertDialogTitle>
          <AlertDialogDescription>
            Tens a certeza que queres desativar <strong>{userName}</strong>? O utilizador deixa de conseguir entrar na app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeactivate}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Desativar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
