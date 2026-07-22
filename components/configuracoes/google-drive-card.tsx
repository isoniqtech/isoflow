"use client"

/**
 * Ligação ao Google Drive por tenant.
 * Os documentos dos projetos são guardados no Drive da própria empresa; o
 * ISOFlow guarda só os metadados. Scope drive.file: a app só vê o que cria.
 */

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FolderOpen, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/portugal"

type Estado = {
  configuravel: boolean
  ligado: boolean
  pasta_raiz: string
  tem_pasta_raiz: boolean
  ligado_em: string | null
  scope: string | null
  sync_error: string | null
}

export function GoogleDriveCard({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [loading, setLoading] = useState(true)
  const [ligando, setLigando] = useState(false)
  const [removendo, setRemovendo] = useState(false)

  useEffect(() => {
    const r = searchParams.get("drive")
    if (r === "connected") {
      toast.success("Google Drive ligado", {
        description:
          searchParams.get("folder") === "pendente"
            ? "A pasta será criada no primeiro documento."
            : "Pasta 'Projetos Flow' pronta.",
      })
      router.replace("/configuracoes/integracoes")
    } else if (r === "error") {
      toast.error("Falha ao ligar o Google Drive", {
        description: searchParams.get("reason") ?? "Tenta novamente",
      })
      router.replace("/configuracoes/integracoes")
    }
  }, [searchParams, router])

  useEffect(() => {
    let cancelado = false
    fetch("/api/integracoes/google-drive")
      .then((r) => r.json())
      .then((b) => {
        if (!cancelado) setEstado(b)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
  }, [])

  async function ligar() {
    setLigando(true)
    try {
      const res = await fetch("/api/integracoes/google-drive/oauth/start", { method: "POST" })
      const body = await res.json()
      if (res.ok && body.redirect_url) {
        window.location.href = body.redirect_url
      } else {
        toast.error("Não foi possível iniciar a ligação", {
          description: body.error ?? `HTTP ${res.status}`,
        })
        setLigando(false)
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
      setLigando(false)
    }
  }

  async function desligar() {
    if (!confirm("Desligar o Google Drive?\n\nOs ficheiros já guardados no Drive mantêm-se, mas o ISOFlow deixa de conseguir aceder-lhes.")) return
    setRemovendo(true)
    try {
      const res = await fetch("/api/integracoes/google-drive", { method: "DELETE" })
      if (res.ok) {
        toast.success("Google Drive desligado")
        setEstado((e) => (e ? { ...e, ligado: false, tem_pasta_raiz: false } : e))
        router.refresh()
      } else {
        const b = await res.json().catch(() => ({}))
        toast.error("Falha ao desligar", { description: b.error ?? `HTTP ${res.status}` })
      }
    } finally {
      setRemovendo(false)
    }
  }

  const status = !estado?.configuravel
    ? "indisponivel"
    : estado?.sync_error
      ? "erro"
      : estado?.ligado
        ? "ligado"
        : "por_ligar"

  return (
    <Card className={cn(status === "erro" && "border-destructive/40")}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">Google Drive</p>
              <p className="text-xs text-muted-foreground">
                Os documentos dos projetos ficam guardados no Drive da tua empresa. O
                ISOFlow guarda apenas os metadados e cria uma pasta por projeto dentro
                de &quot;{estado?.pasta_raiz ?? "Projetos Flow"}&quot;.
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {estado?.ligado && (
          <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-3">
            {estado.ligado_em && <p>Ligado em {formatDate(estado.ligado_em)}</p>}
            <p>
              Pasta raiz: <span className="font-mono">{estado.pasta_raiz}</span>
              {!estado.tem_pasta_raiz && " (será criada no primeiro documento)"}
            </p>
            <p>Acesso limitado aos ficheiros criados pelo ISOFlow (scope drive.file)</p>
            {estado.sync_error && <p className="text-destructive break-all">{estado.sync_error}</p>}
          </div>
        )}

        {!estado?.configuravel && !loading && (
          <p className="text-xs text-amber-600 dark:text-amber-400 border-t pt-3">
            Faltam as variáveis GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET.
            O URI de redirect a registar no Google Cloud é{" "}
            <span className="font-mono">/api/integracoes/google-drive/oauth/callback</span>.
          </p>
        )}

        {canEdit && (
          <div className="flex flex-wrap justify-end gap-2 pt-1 border-t">
            {estado?.ligado && (
              <Button variant="ghost" size="sm" onClick={desligar} disabled={removendo}>
                {removendo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Desligar
              </Button>
            )}
            <Button
              size="sm"
              variant={estado?.ligado ? "outline" : "default"}
              onClick={ligar}
              disabled={ligando || loading || !estado?.configuravel}
            >
              {ligando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {estado?.ligado ? "Voltar a ligar" : "Ligar ao Google Drive"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: "ligado" | "por_ligar" | "erro" | "indisponivel" }) {
  const map = {
    ligado: {
      label: "Ligado",
      dot: "bg-emerald-500",
      className:
        "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
    },
    por_ligar: { label: "Por ligar", dot: "bg-muted-foreground", className: "" },
    indisponivel: { label: "Indisponível", dot: "bg-muted-foreground", className: "" },
    erro: {
      label: "Erro",
      dot: "bg-destructive",
      className:
        "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
    },
  } as const

  const s = map[status]
  return (
    <Badge variant="outline" className={cn("shrink-0", s.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", s.dot)} />
      {s.label}
    </Badge>
  )
}
