"use client"

import { useState } from "react"
import { MessageCircle, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Props = {
  isActive: boolean
  hasCredentials: boolean
  phoneNumber: string | null
  canEdit: boolean
}

export function WhatsAppIntegrationCard({
  isActive: initialActive,
  hasCredentials: initialHasCredentials,
  phoneNumber: initialPhone,
  canEdit,
}: Props) {
  const [isActive, setIsActive] = useState(initialActive)
  const [hasCredentials, setHasCredentials] = useState(initialHasCredentials)
  const [phoneNumber, setPhoneNumber] = useState(initialPhone)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showForm, setShowForm] = useState(!initialHasCredentials)

  const [accountSid, setAccountSid] = useState("")
  const [authToken, setAuthToken] = useState("")
  const [phone, setPhone] = useState("")

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/whatsapp`
      : "/api/webhooks/whatsapp"

  async function activate() {
    if (!accountSid.trim() || !authToken.trim() || !phone.trim()) {
      toast.error("Preenche todos os campos")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/integracoes/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate",
          account_sid: accountSid.trim(),
          auth_token: authToken.trim(),
          phone_number: phone.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      setIsActive(true)
      setHasCredentials(true)
      setPhoneNumber(phone.trim())
      setShowForm(false)
      setAccountSid("")
      setAuthToken("")
      setPhone("")
      toast.success("WhatsApp ativado")
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function reactivate() {
    setLoading(true)
    try {
      const res = await fetch("/api/integracoes/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      setIsActive(true)
      toast.success("WhatsApp ativado")
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function deactivate() {
    setLoading(true)
    try {
      const res = await fetch("/api/integracoes/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      setIsActive(false)
      toast.success("WhatsApp desativado")
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
                Recebe faturas com a tua conta Twilio. Cada empresa usa as suas proprias credenciais.
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

        {isActive && phoneNumber && (
          <p className="text-xs text-muted-foreground">
            Numero:{" "}
            <span className="font-mono text-foreground">{phoneNumber}</span>
          </p>
        )}

        {isActive && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 space-y-1">
            <p className="text-xs text-muted-foreground">
              URL do webhook (configurar no Twilio Console)
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono truncate flex-1 text-foreground">
                {webhookUrl}
              </code>
              <button
                onClick={copyUrl}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Copiar URL"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {canEdit && showForm && (
          <div className="space-y-2 pt-1">
            <div className="space-y-1">
              <Label htmlFor="wa-sid" className="text-xs">
                Twilio Account SID
              </Label>
              <Input
                id="wa-sid"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wa-token" className="text-xs">
                Auth Token
              </Label>
              <Input
                id="wa-token"
                type="password"
                placeholder="Token da consola Twilio"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wa-phone" className="text-xs">
                Numero WhatsApp (com prefixo +)
              </Label>
              <Input
                id="wa-phone"
                placeholder="+14155238886"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {canEdit && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex gap-3">
              {hasCredentials && !showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Editar credenciais
                </button>
              )}
              {showForm && hasCredentials && (
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div className="ml-auto flex gap-2">
              {isActive ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={deactivate}
                  disabled={loading}
                >
                  {loading ? "A processar..." : "Desativar"}
                </Button>
              ) : showForm ? (
                <Button size="sm" onClick={activate} disabled={loading}>
                  {loading ? "A guardar..." : "Ativar WhatsApp"}
                </Button>
              ) : (
                <Button size="sm" onClick={reactivate} disabled={loading}>
                  {loading ? "A processar..." : "Ativar"}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
