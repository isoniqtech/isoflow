"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Admin error:", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold mb-1">Erro no admin</h1>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        {error.message || "Não conseguimos carregar esta página."}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Tentar de novo
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin">Voltar à overview</Link>
        </Button>
      </div>
    </div>
  )
}
