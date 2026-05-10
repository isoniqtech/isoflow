"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function AutoReconcileButton({ className }: { className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleRun() {
    setBusy(true)
    const res = await fetch("/api/conciliacao/auto", { method: "POST" })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha na conciliação automática", {
        description: errBody.error ?? `HTTP ${res.status}`,
        duration: 10000,
      })
      setBusy(false)
      return
    }
    const { data } = await res.json()
    toast.success("Conciliação concluída", {
      description: `${data.auto_confirmed} confirmadas · ${data.suggestions} sugestões · ${data.scanned_invoices} faturas × ${data.scanned_transactions} movimentos analisados`,
      duration: 8000,
    })
    setBusy(false)
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRun}
      disabled={busy}
      className={className}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" />
      )}
      Auto-conciliar
    </Button>
  )
}
