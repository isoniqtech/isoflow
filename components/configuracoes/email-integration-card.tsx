"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/portugal"

type Provider = "gmail" | "outlook" | "imap"

type Existing = {
  id: string
  provider: Provider
  email: string
  imapHost: string | null
  imapPort: number | null
  tag: string | null
  is_active: boolean
  last_sync_at: string | null
  sync_error: string | null
  has_password: boolean
}

export function EmailIntegrationCard({
  initial,
  canEdit,
}: {
  initial: Existing | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [provider, setProvider] = useState<Provider>(initial?.provider ?? "gmail")
  const [email, setEmail] = useState(initial?.email ?? "")
  const [appPassword, setAppPassword] = useState("")
  const [imapHost, setImapHost] = useState(initial?.imapHost ?? "")
  const [imapPort, setImapPort] = useState<string>(
    initial?.imapPort ? String(initial.imapPort) : "993",
  )
  const [tag, setTag] = useState(initial?.tag ?? "")
  const [showForm, setShowForm] = useState(!initial || !initial.is_active)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (initial?.sync_error) {
      toast.error("Erro na última sincronização", {
        description: initial.sync_error,
        duration: 8000,
      })
    }
  }, [initial?.sync_error])

  function buildPayload(includePassword: boolean) {
    const port = parseInt(imapPort, 10)
    return {
      provider,
      email: email.trim(),
      ...(includePassword && appPassword ? { appPassword } : {}),
      ...(provider === "imap"
        ? {
            imapHost: imapHost.trim() || null,
            imapPort: Number.isNaN(port) ? 993 : port,
          }
        : {}),
      ...(tag.trim() ? { tag: tag.trim().replace(/^\+/, "") } : { tag: null }),
    }
  }

  async function handleTest() {
    if (!email || !appPassword) {
      toast.error("Email e password são obrigatórios para testar")
      return
    }
    setTesting(true)
    try {
      const res = await fetch("/api/integracoes/email/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload(true)),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Ligação IMAP bem sucedida")
      } else {
        toast.error("Falha na ligação IMAP", {
          description: body.error ?? `HTTP ${res.status}`,
          duration: 10000,
        })
      }
    } catch (e) {
      toast.error("Erro a contactar o servidor", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!email) {
      toast.error("Email obrigatório")
      return
    }
    if (!initial && !appPassword) {
      toast.error("App password obrigatória")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/integracoes/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload(true)),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success(initial ? "Integração atualizada" : "Integração ligada")
        setAppPassword("")
        setShowForm(false)
        router.refresh()
      } else {
        toast.error("Falha ao guardar", {
          description: body.error ?? `HTTP ${res.status}`,
        })
      }
    } catch (e) {
      toast.error("Erro a contactar o servidor", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch("/api/email/sync", { method: "POST" })
      const body = await res.json()
      if (res.ok) {
        const {
          emailsPrefilter,
          emailsFetched,
          rejectedAddresses,
          invoicesCreated,
          duplicatesSkipped,
          errors,
        } = body.data
        const parts = [
          `${emailsFetched} email(s)`,
          `${invoicesCreated} fatura(s)`,
        ]
        if (duplicatesSkipped > 0) parts.push(`${duplicatesSkipped} duplicado(s)`)
        toast.success("Sincronização concluída", {
          description: parts.join(" · "),
        })

        // Se a tag rejeitou tudo, mostrar pista útil ao user
        if (
          emailsPrefilter > 0 &&
          emailsFetched === 0 &&
          rejectedAddresses?.length
        ) {
          const list = rejectedAddresses.slice(0, 3).join(", ")
          toast.warning(
            `${emailsPrefilter} email(s) ignorados pela tag de routing`,
            {
              description: `Para: ${list}${rejectedAddresses.length > 3 ? "…" : ""}\nReencaminha para "${initial?.email?.replace("@", `+${initial.tag}@`) ?? "<email>+<tag>"}" ou apaga a tag.`,
              duration: 15000,
            },
          )
        }

        if (errors?.length) {
          toast.error(`${errors.length} erro(s)`, {
            description: errors.slice(0, 3).join("\n"),
            duration: 12000,
          })
        }
        router.refresh()
      } else {
        toast.error("Sincronização falhou", {
          description: body.error ?? `HTTP ${res.status}`,
        })
      }
    } catch (e) {
      toast.error("Erro a contactar o servidor", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSyncing(false)
    }
  }

  async function handleRemove() {
    if (!confirm("Desligar a integração de email? Os emails deixarão de ser processados.")) {
      return
    }
    setRemoving(true)
    try {
      const res = await fetch("/api/integracoes/email", { method: "DELETE" })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Integração desligada")
        router.refresh()
      } else {
        toast.error("Falha ao remover", {
          description: body.error ?? `HTTP ${res.status}`,
        })
      }
    } catch (e) {
      toast.error("Erro a contactar o servidor", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setRemoving(false)
    }
  }

  const status = initial?.is_active
    ? initial.sync_error
      ? "error"
      : "connected"
    : initial
      ? "disconnected"
      : "soon"

  return (
    <Card className={cn(status === "error" && "border-destructive/40")}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">Email (IMAP)</p>
              <p className="text-xs text-muted-foreground">
                Liga a tua caixa de entrada (Gmail / Outlook / IMAP) para
                receber faturas automaticamente.
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {initial && status !== "soon" && status !== "disconnected" && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>
              <span className="font-medium text-foreground">{initial.email}</span>
              {" · "}
              <span className="capitalize">{initial.provider}</span>
              {initial.tag && (
                <>
                  {" · tag +"}
                  <span className="font-mono">{initial.tag}</span>
                </>
              )}
            </p>
            {initial.last_sync_at && (
              <p>Última sincronização: {formatDate(initial.last_sync_at)}</p>
            )}
            {initial.sync_error && (
              <p className="text-destructive">{initial.sync_error}</p>
            )}
          </div>
        )}

        {canEdit && showForm && (
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email-provider">Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => setProvider(v as Provider)}
                >
                  <SelectTrigger id="email-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="outlook">Outlook</SelectItem>
                    <SelectItem value="imap">IMAP custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-email">Email</Label>
                <Input
                  id="email-email"
                  type="email"
                  placeholder="faturas@empresa.pt"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-pass">
                App password
                {initial?.has_password && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (deixa em branco para manter a atual)
                  </span>
                )}
              </Label>
              <Input
                id="email-pass"
                type="password"
                placeholder={
                  initial?.has_password ? "•••••••• (atual)" : "App password"
                }
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                autoComplete="new-password"
              />
              {provider === "gmail" && (
                <p className="text-xs text-muted-foreground">
                  Gera em{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    myaccount.google.com/apppasswords
                  </a>
                  . Precisas de 2FA ativo.
                </p>
              )}
            </div>

            {provider === "imap" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="imap-host">IMAP Host</Label>
                  <Input
                    id="imap-host"
                    placeholder="imap.empresa.pt"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="imap-port">Porta</Label>
                  <Input
                    id="imap-port"
                    type="number"
                    placeholder="993"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email-tag">
                Tag de routing
                <span className="text-xs text-muted-foreground ml-2">
                  (opcional — só processa emails enviados para email+tag@domain)
                </span>
              </Label>
              <Input
                id="email-tag"
                placeholder="faturas"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {initial?.is_active && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false)
                    setAppPassword("")
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || !appPassword || !email}
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Testar ligação
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving || !email}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initial?.is_active ? "Guardar alterações" : "Ligar"}
              </Button>
            </div>
          </div>
        )}

        {!showForm && canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Desligar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              Editar
            </Button>
            <Button size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sincronizar agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({
  status,
}: {
  status: "connected" | "disconnected" | "error" | "soon"
}) {
  const map = {
    connected: {
      label: "Ligado",
      dot: "bg-emerald-500",
      className:
        "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
    },
    disconnected: {
      label: "Desligado",
      dot: "bg-muted-foreground",
      className: "",
    },
    error: {
      label: "Erro",
      dot: "bg-destructive",
      className:
        "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
    },
    soon: {
      label: "Pronto a ligar",
      dot: "bg-blue-500",
      className:
        "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
    },
  } as const

  const s = map[status]
  const Icon = status === "error" ? XCircle : null
  return (
    <Badge variant="outline" className={cn("shrink-0", s.className)}>
      {Icon ? (
        <Icon className="h-3 w-3 mr-1" />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", s.dot)} />
      )}
      {s.label}
    </Badge>
  )
}
