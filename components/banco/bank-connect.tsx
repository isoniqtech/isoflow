"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Landmark, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function BankConnectButton({
  variant = "default",
  label = "Ligar banco",
  className,
}: {
  variant?: "default" | "outline"
  label?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)

  async function handleConnect() {
    setBusy(true)
    const res = await fetch("/api/banco/connect", { method: "POST" })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Não foi possível iniciar ligação", {
        description: errBody.error ?? `HTTP ${res.status}`,
        duration: 10000,
      })
      setBusy(false)
      return
    }
    const { data } = await res.json()
    if (data?.url) {
      window.location.href = data.url
    } else {
      toast.error("URL Tink não recebido")
      setBusy(false)
    }
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleConnect}
      disabled={busy}
      className={className}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Landmark className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  )
}

export function BankSyncButton({ className }: { className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleSync() {
    setBusy(true)
    const res = await fetch("/api/banco/sync", { method: "POST" })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha a sincronizar", {
        description: errBody.error ?? `HTTP ${res.status}`,
        duration: 10000,
      })
      setBusy(false)
      return
    }
    const { data } = await res.json()
    toast.success("Sincronização concluída", {
      description: `${data.inserted} novos movimentos · ${data.total} totais`,
    })
    setBusy(false)
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={busy}
      className={className}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      Sincronizar
    </Button>
  )
}

/**
 * Lê banking_connected / banking_error da URL após o callback Tink e
 * mostra um toast. Limpa os params para evitar re-trigger ao recarregar.
 */
export function BankCallbackToast() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const connected = searchParams.get("banking_connected")
    const error = searchParams.get("banking_error")

    if (connected) {
      toast.success(`Banco ligado com ${connected} conta(s)`, {
        description: "Podes agora sincronizar movimentos.",
      })
    } else if (error) {
      toast.error("Falha a ligar banco", { description: error, duration: 10000 })
    }

    if (connected || error) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("banking_connected")
      params.delete("banking_error")
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
    }
  }, [searchParams, router])

  return null
}
