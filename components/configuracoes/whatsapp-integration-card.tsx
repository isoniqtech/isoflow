"use client"

import { useState } from "react"
import { MessageCircle, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  isActive: boolean
  canEdit: boolean
}

export function WhatsAppIntegrationCard({ isActive: initialActive, canEdit }: Props) {
  const [isActive, setIsActive] = useState(initialActive)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/webhooks/whatsapp`

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch("/api/integracoes/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isActive ? "deactivate" : "activate" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      setIsActive(json.is_active)
      toast.success(json.is_active ? "WhatsApp ativado" : "WhatsApp desativado")
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                Recebe faturas via WhatsApp. A app processa com IA e associa ao projeto certo.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0",
              isActive
                ? "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40"
                : "",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full mr-1.5",
                isActive ? "bg-emerald-500" : "bg-muted-foreground",
              )}
            />
            {isActive ? "Ligado" : "Desligado"}
          </Badge>
        </div>

        {isActive && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 space-y-1">
            <p className="text-xs text-muted-foreground">URL do webhook (configurar no Twilio Console)</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono truncate flex-1 text-foreground">{webhookUrl}</code>
              <button
                onClick={copyUrl}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Copiar URL"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}

        {canEdit && (
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              variant={isActive ? "outline" : "default"}
              onClick={toggle}
              disabled={loading}
            >
              {loading ? "A processar..." : isActive ? "Desativar" : "Ativar WhatsApp"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
