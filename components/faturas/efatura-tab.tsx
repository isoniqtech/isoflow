"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, FileText, Loader2, RefreshCw, ChevronDown, Download, Sheet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { EFaturaPageData, EFaturaDocument } from "@/lib/queries/efatura-documents"

const AT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "Pendente",          label: "Pendente" },
  { value: "Associada",         label: "Compra Registada" },
  { value: "compra_registada",  label: "Compra Registada (AT)" },
  { value: "doc_contabilidade", label: "Doc. Contabilidade" },
  { value: "nao_considerado",   label: "Não Considerado" },
]

function MultiSelectFilter<T extends string>({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (next: T[]) => void
  placeholder: string
}) {
  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    )
  }

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
    ? options.find(o => o.value === selected[0])?.label ?? placeholder
    : `${selected.length} estados`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium bg-background hover:bg-muted transition-colors">
          {selected.length > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] px-1">
              {selected.length}
            </span>
          )}
          <span className="max-w-32 truncate">{label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="end">
        {selected.length > 0 && (
          <>
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              Limpar filtros
            </button>
            <div className="my-1 border-t" />
          </>
        )}
        {options.map(o => (
          <label
            key={o.value}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs rounded hover:bg-muted cursor-pointer"
          >
            <Checkbox
              checked={selected.includes(o.value)}
              onCheckedChange={() => toggle(o.value)}
              className="h-3.5 w-3.5"
            />
            {o.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function ATStatusBadge({ status }: { status: string | null }) {
  if (status === "compra_registada" || status === "Associada")
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">Compra Registada</span>
  if (status === "doc_contabilidade")
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Doc. Contabilidade</span>
  if (status === "nao_considerado")
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">Não considerado</span>
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">{status === "Pendente" ? "Pendente" : "Sem associação"}</span>
}

export function EFaturaTab({ data }: { data: EFaturaPageData }) {
  const { efatura_docs, efatura_docs_matched } = data
  const router = useRouter()

  const [atFilters, setAtFilters] = useState<string[]>([])
  const [showMatched, setShowMatched] = useState(false)
  const [isPendingRefresh, startRefresh] = useTransition()

  const filteredDocs = useMemo(() => {
    if (atFilters.length === 0) return efatura_docs
    return efatura_docs.filter(d => d.at_status !== null && atFilters.includes(d.at_status))
  }, [efatura_docs, atFilters])

  function handleRefresh() {
    startRefresh(async () => {
      try {
        const res = await fetch("/api/efatura/refresh", { method: "POST" })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? "Erro ao atualizar e-Fatura")
          return
        }
        const { n8n_triggered, matched, at_communicated_updated } = json as {
          n8n_triggered: boolean
          matched: number
          at_communicated_updated: number
        }
        const lines: string[] = []
        if (n8n_triggered) lines.push("dados frescos pedidos ao AT")
        if (matched > 0) lines.push(`${matched} fatura${matched !== 1 ? "s" : ""} associada${matched !== 1 ? "s" : ""}`)
        if (at_communicated_updated > 0) lines.push(`${at_communicated_updated} marcada${at_communicated_updated !== 1 ? "s" : ""} AT`)
        toast.success("e-Fatura atualizada", {
          description: lines.length ? lines.join(" · ") : "Sem alterações",
        })
        router.refresh()
      } catch {
        toast.error("Erro de ligação ao servidor")
      }
    })
  }

  function exportUrl(format: "csv" | "xlsx" | "pdf") {
    const params = new URLSearchParams({ format })
    if (atFilters.length > 0) params.set("at_status", atFilters.join(","))
    return `/api/efatura/export?${params.toString()}`
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">

      {/* ── Toolbar — estática ───────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filteredDocs.length} documento{filteredDocs.length !== 1 ? "s" : ""} AT pendente{filteredDocs.length !== 1 ? "s" : ""}
          {filteredDocs.length !== efatura_docs.length && ` (${efatura_docs.length} total)`}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <MultiSelectFilter
            options={AT_STATUS_OPTIONS}
            selected={atFilters}
            onChange={setAtFilters}
            placeholder="Estado AT"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={exportUrl("csv")} download>
                  <Sheet className="mr-2 h-4 w-4" />
                  CSV
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportUrl("xlsx")} download>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel (.xlsx)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportUrl("pdf")} download>
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isPendingRefresh}>
            {isPendingRefresh
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />
            }
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── Tabela + arquivo — área com scroll ───────────────── */}
      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        {/* Documentos AT — thead sticky */}
        {filteredDocs.length === 0 ? (
          <EmptyState icon={FileText} title="Sem documentos pendentes" description="Todos os documentos AT já estão associados a faturas." />
        ) : (
          <div className="rounded-lg border bg-background">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">Nº Documento</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Estado AT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <p className="font-medium truncate">{doc.supplier_name ?? "Fornecedor desconhecido"}</p>
                      {doc.supplier_nif && <p className="text-xs text-muted-foreground font-mono">{doc.supplier_nif}</p>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-sm">{doc.document_number ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{doc.document_date ? formatDate(doc.document_date) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{doc.total !== null ? formatCurrency(doc.total!) : "—"}</TableCell>
                    <TableCell><ATStatusBadge status={doc.at_status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}

        {/* Compras Registadas (arquivo) */}
        {efatura_docs_matched.length > 0 && (
          <section className="pb-4">
            <button
              onClick={() => setShowMatched(v => !v)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showMatched ? "▲" : "▶"} Compras Registadas ({efatura_docs_matched.length})
            </button>
            {showMatched && (
              <div className="mt-3 rounded-lg border bg-background">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="hidden md:table-cell">Nº e-Fatura</TableHead>
                      <TableHead className="hidden md:table-cell">Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Estado AT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {efatura_docs_matched.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <p className="font-medium truncate">{doc.supplier_name ?? "—"}</p>
                          {doc.supplier_nif && <p className="text-xs text-muted-foreground font-mono">{doc.supplier_nif}</p>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-sm">{doc.document_number ?? "—"}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{doc.document_date ? formatDate(doc.document_date) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{doc.total !== null ? formatCurrency(doc.total!) : "—"}</TableCell>
                        <TableCell><ATStatusBadge status={doc.at_status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
  return (
    <div className="border rounded-lg p-8 flex flex-col items-center text-center bg-background">
      <Icon className="h-8 w-8 text-muted-foreground mb-2" />
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
    </div>
  )
}
