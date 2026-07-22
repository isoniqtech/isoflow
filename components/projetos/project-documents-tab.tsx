"use client"

/**
 * Tab de Documentação do projeto.
 *
 * Layout em grelha de cartões (não linhas de largura total): cada documento é
 * um cartão com o nome por cima, e o último cartão de cada secção editável é
 * um tracejado para adicionar. O formulário vive num diálogo.
 *
 * Admin: duas secções (interna / partilhada).
 * Quem acompanha o projeto de fora só vê a secção partilhada, em leitura.
 *
 * Nota: o valor guardado na BD continua a ser "investidores" (migration 043);
 * só o rótulo visível mudou, para ser mais genérico.
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
  Plus,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SectionHeader } from "@/components/ui/section-header"
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

/** Grelha partilhada por todas as secções, para manter os cartões alinhados. */
const GRELHA = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"

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
  const [adicionar, setAdicionar] = useState<Visibilidade | null>(null)

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

  const podeEditar = canEdit && !isInvestidor
  const internos = docs.filter((d) => d.visibility === "interna")
  const partilhados = docs.filter((d) => d.visibility === "investidores")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        A carregar documentos...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {!isInvestidor && (
        <Seccao
          titulo="Documentação interna"
          descricao="Visível apenas para a equipa interna."
          docs={internos}
          projectId={projectId}
          podeEditar={podeEditar}
          onAdicionar={() => setAdicionar("interna")}
          onMudou={carregar}
        />
      )}

      <Seccao
        titulo="Documentos partilhados"
        descricao={
          isInvestidor
            ? "Documentos que a equipa partilhou contigo."
            : "Partilhados com quem acompanha o projeto, em leitura."
        }
        docs={partilhados}
        projectId={projectId}
        podeEditar={podeEditar}
        onAdicionar={() => setAdicionar("investidores")}
        onMudou={carregar}
      />

      {adicionar && (
        <DialogoAdicionar
          projectId={projectId}
          visibilidadeInicial={adicionar}
          onFechar={() => setAdicionar(null)}
          onAdicionado={carregar}
        />
      )}
    </div>
  )
}

function Seccao({
  titulo,
  descricao,
  docs,
  projectId,
  podeEditar,
  onAdicionar,
  onMudou,
}: {
  titulo: string
  descricao: string
  docs: Documento[]
  projectId: string
  podeEditar: boolean
  onAdicionar: () => void
  onMudou: () => void
}) {
  return (
    <div className="space-y-3">
      <SectionHeader titulo={titulo} descricao={descricao} contador={docs.length} />

      {docs.length === 0 && !podeEditar ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
          <FileText className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sem documentos.</p>
        </div>
      ) : (
        <div className={GRELHA}>
          {docs.map((doc) => (
            <CartaoDocumento
              key={doc.id}
              doc={doc}
              projectId={projectId}
              podeEditar={podeEditar}
              onMudou={onMudou}
            />
          ))}
          {podeEditar && <CartaoAdicionar onClick={onAdicionar} />}
        </div>
      )}
    </div>
  )
}

/** Cartão de um documento já carregado. */
function CartaoDocumento({
  doc,
  projectId,
  podeEditar,
  onMudou,
}: {
  doc: Documento
  projectId: string
  podeEditar: boolean
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
    <div className="space-y-1.5">
      <p className="truncate text-sm font-medium" title={doc.name}>
        {doc.name}
      </p>

      <div className="surface-card surface-card-hover p-3">
        <a
          href={base}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 py-2"
          title="Pré-visualizar"
        >
          <FileText className="h-6 w-6 text-primary" />
          <span className="text-xs text-muted-foreground">Ver</span>
        </a>

        <div className="mt-2 flex items-center justify-center gap-0.5 border-t pt-1.5">
          <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0" title="Pré-visualizar">
            <a href={base} target="_blank" rel="noopener noreferrer">
              <Eye className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0" title="Descarregar">
            <a href={`${base}?download=1`}>
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
          {doc.web_view_link && (
            <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0" title="Abrir no Drive">
              <a href={doc.web_view_link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {podeEditar && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={apagar}
              disabled={apagando}
              title="Apagar"
            >
              {apagando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      <p className="truncate text-xs text-muted-foreground">
        {formatDate(doc.created_at)}
        {doc.size_bytes ? ` · ${formatarTamanho(doc.size_bytes)}` : ""}
      </p>
    </div>
  )
}

/** Cartão tracejado para adicionar, no fim da grelha. */
function CartaoAdicionar({ onClick }: { onClick: () => void }) {
  return (
    <div className="space-y-1.5">
      <p className="truncate text-sm font-medium text-muted-foreground">Novo documento</p>
      <button
        type="button"
        onClick={onClick}
        className="surface-empty flex w-full flex-col items-center gap-1.5 px-3 py-[1.35rem]"
      >
        <Plus className="h-6 w-6 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Adicionar</span>
      </button>
      <p className="text-xs text-muted-foreground">Qualquer ficheiro, até 20 MB</p>
    </div>
  )
}

function DialogoAdicionar({
  projectId,
  visibilidadeInicial,
  onFechar,
  onAdicionado,
}: {
  projectId: string
  visibilidadeInicial: Visibilidade
  onFechar: () => void
  onAdicionado: () => void
}) {
  const [nome, setNome] = useState("")
  const [ficheiro, setFicheiro] = useState<File | null>(null)
  const [visibilidade, setVisibilidade] = useState<Visibilidade>(visibilidadeInicial)
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
        onAdicionado()
        onFechar()
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
    <Dialog open onOpenChange={onFechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar documento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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
            <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            {ficheiro ? (
              <p className="truncate text-sm font-medium">{ficheiro.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Arrasta um ficheiro para aqui ou</p>
            )}
            <label className="mt-2 inline-block">
              <input
                type="file"
                className="hidden"
                onChange={(e) => escolher(e.target.files?.[0] ?? null)}
              />
              <span className="cursor-pointer text-sm underline underline-offset-2">
                {ficheiro ? "escolher outro" : "escolher ficheiro"}
              </span>
            </label>
          </div>

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
                <SelectItem value="investidores">Partilhada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={aEnviar}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={aEnviar || !ficheiro}>
            {aEnviar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {aEnviar ? "A enviar..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
