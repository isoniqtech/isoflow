"use client"

import { useState } from "react"
import { toast } from "sonner"
import { KeyRound } from "lucide-react"
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

export function UserResetPasswordButton({
  userId,
  userName,
}: {
  userId: string
  userName: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    setLoading(true)
    const res = await fetch(`/api/utilizadores/${userId}/reset-password`, { method: "POST" })
    if (res.ok) {
      toast.success(`Email de reset enviado para ${userName}`)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Erro ao enviar email")
    }
    setLoading(false)
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 px-2"
          title="Enviar reset de password"
        >
          <KeyRound className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar reset de password</AlertDialogTitle>
          <AlertDialogDescription>
            Vai ser enviado um email a <strong>{userName}</strong> com um link para definir uma nova password. O link e valido durante 1 hora.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset} disabled={loading}>
            Enviar email
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
