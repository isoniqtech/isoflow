"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold mb-1">Ocorreu um erro</h1>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        Não conseguimos carregar esta página. Tenta de novo. Se o problema
        persistir, abre um ticket de suporte.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono mb-4">
          Ref: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Tentar de novo
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Voltar ao dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
