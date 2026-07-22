"use client"

/**
 * Tab de Documentação do projeto.
 *
 * Admin: duas secções (interna / para investidores) e um cartão para adicionar.
 * Investidor: só a secção de documentos para investidores, em leitura.
 *
 * Os ficheiros vivem no Google Drive do tenant; aqui só se veem metadados.
 * Preview e download passam pelo proxy do backend, por isso o utilizador não
 * precisa de conta Google.
 */

import { useCallback, useEffect, useState } from "react"
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

export type Visibilidade = "interna" | "investidores"

export type Documento = {
  id: string
  name: string
  mime_type: string | null
  web_view_link: string | null
  size_bytes: number | null
  visibility: Visibilidade
  created_at: string
}

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ProjectDocumentsTab({
  projectId,
  canEdit,
  isInvestidor,
}: {
  projectId: string
  canEdit: boolean
  isInvestidor: boolean
}) {
  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/projetos/${projectId}/documentos`)
      const body = await res.json()
      if (res.ok) setDocs(body.documentos ?? [])
    } catch {
      // silencioso: a lista fica vazia e o utilizador pode tentar de novo
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const internos = docs.filter((d) => d.visibility === "interna")
  const paraInvestidores = docs.filter((d) => d.visibility === "investidores")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        A carregar documentos...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {canEdit && !isInvestidor && (
        <AdicionarDocumento projectId={projectId} onAdicionado={carregar} />
      )}

      {!isInvestidor && (
        <Seccao
          titulo="Documentação interna"
          descricao="Visível apenas para a equipa. Os investidores não têm acesso."
          docs={internos}
          projectId={projectId}
          canEdit={canEdit}
          onMudou={carregar}
        />
      )}

      <Seccao
        titulo="Documentos para investidores"
        descricao={
          isInvestidor
            ? "Documentos que a equipa partilhou contigo."
            : "Visíveis no portal do investidor, em leitura."
        }
        docs={paraInvestidores}
        projectId={projectId}
        canEdit={canEdit && !isInvestidor}
        onMudou={carregar}
      />
    </div>
  )
}

function Seccao({
  titulo,
  descricao,
  docs,
  projectId,
  canEdit,
  onMudou,
}: {
  titulo: string
  descricao: string
  docs: Documento[]
  projectId: string
  canEdit: boolean
  onMudou: () => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
          <FileText className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sem documentos.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card divide-y">
          {docs.map((doc) => (
            <LinhaDocumento
              key={doc.id}
              doc={doc}
              projectId={projectId}
              canEdit={canEdit}
              onMudou={onMudou}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LinhaDocumento({
  doc,
  projectId,
  canEdit,
  onMudou,
}: {
  doc: Documento
  projectId: string
  canEdit: boolean
  onMudou: () => void
}) {
  const [apagando, setApagando] = useState(false)
  const base = `/api/projetos/${projectId}/documentos/${doc.id}/ficheiro`

  async function apagar() {
    if (!confirm(`Apagar "${doc.name}"?\n\nO ficheiro é removido também do Google Drive.`)) return
    setApagando(true)
    try {
      const res = await fetch(`/api/projetos/${projectId}/documentos/${doc.id}`, {
        method: "DELETE",
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success("Documento apagado")
        onMudou()
      } else {
        toast.error("Falha ao apagar", { description: body.error ?? `HTTP ${res.status}` })
      }
    } finally {
      setApagando(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(doc.created_at)}
          {doc.size_bytes ? ` · ${formatarTamanho(doc.size_bytes)}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button asChild variant="ghost" size="sm" title="Pré-visualizar">
          <a href={base} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4" />
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm" title="Descarregar">
          <a href={`${base}?download=1`}>
            <Download className="h-4 w-4" />
          </a>
        </Button>
        {doc.web_view_link && (
          <Button asChild variant="ghost" size="sm" title="Abrir no Drive">
            <a href={doc.web_view_link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={apagar}
            disabled={apagando}
            title="Apagar"
            className="text-destructive hover:text-destructive"
          >
            {apagando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}

function AdicionarDocumento({
  projectId,
  onAdicionado,
}: {
  projectId: string
  onAdicionado: () => void
}) {
  const [nome, setNome] = useState("")
  const [ficheiro, setFicheiro] = useState<File | null>(null)
  const [visibilidade, setVisibilidade] = useState<Visibilidade>("interna")
  const [aEnviar, setAEnviar] = useState(false)
  const [arrastar, setArrastar] = useState(false)

  function escolher(f: File | null) {
    setFicheiro(f)
    // Sugerir o nome do ficheiro (sem extensão) se ainda não houver nome
    if (f && !nome.trim()) setNome(f.name.replace(/\.[^.]+$/, ""))
  }

  async function enviar() {
    if (!ficheiro) return toast.error("Escolhe um ficheiro")
    if (!nome.trim()) return toast.error("Dá um nome ao documento")

    setAEnviar(true)
    try {
      const fd = new FormData()
      fd.append("file", ficheiro)
      fd.append("name", nome.trim())
      fd.append("visibility", visibilidade)

      const res = await fetch(`/api/projetos/${projectId}/documentos`, {
        method: "POST",
        body: fd,
      })
      const body = await res.json().catch(() => ({}))

      if (res.ok) {
        toast.success("Documento adicionado")
        setNome("")
        setFicheiro(null)
        onAdicionado()
      } else {
        toast.error("Falha ao adicionar", {
          description: body.error ?? `HTTP ${res.status}`,
          duration: 12000,
        })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Adicionar documento</h2>
          <p className="text-xs text-muted-foreground">
            Qualquer tipo de ficheiro, até 20 MB. É guardado no Google Drive da empresa.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastar(true)
          }}
          onDragLeave={() => setArrastar(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastar(false)
            escolher(e.dataTransfer.files?.[0] ?? null)
          }}
          className={cn(
            "rounded-lg border border-dashed p-6 text-center transition-colors",
            arrastar ? "border-primary bg-primary/5" : "border-border/60",
          )}
        >
          <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          {ficheiro ? (
            <p className="text-sm font-medium truncate">{ficheiro.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Arrasta um ficheiro para aqui ou
            </p>
          )}
          <label className="mt-2 inline-block">
            <input
              type="file"
              className="hidden"
              onChange={(e) => escolher(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm underline underline-offset-2 cursor-pointer">
              {ficheiro ? "escolher outro" : "escolher ficheiro"}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="doc-nome">Nome do documento</Label>
            <Input
              id="doc-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex: Licença de construção"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-vis">Visibilidade</Label>
            <Select value={visibilidade} onValueChange={(v) => setVisibilidade(v as Visibilidade)}>
              <SelectTrigger id="doc-vis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interna">Interna (só a equipa)</SelectItem>
                <SelectItem value="investidores">Para investidores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={enviar} disabled={aEnviar || !ficheiro}>
            {aEnviar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {aEnviar ? "A enviar..." : "Adicionar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
