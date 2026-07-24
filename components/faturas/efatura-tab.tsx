"use client"

import { useState, useTransition, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, RefreshCw, History, CalendarDays, SlidersHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { ExportDropdown } from "@/components/faturas/export-dropdown"
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


function ATStatusBadge({ status }: { status: string | null }) {
  if (status === "compra_registada" || status === "Associada")
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">Compra Registada</span>
  if (status === "doc_contabilidade")
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Doc. Contabilidade</span>
  if (status === "nao_considerado")
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">Não considerado</span>
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">{status === "Pendente" ? "Pendente" : "Sem associação"}</span>
}

const HEADERS = [
  { label: "Fornecedor",    tip: "Nome e NIF do fornecedor, tal como comunicado ao portal e-Fatura pelo próprio fornecedor" },
  { label: "Nº Documento",  tip: "Número da fatura comunicada ao AT pelo fornecedor - usar para cruzar com a fatura em ISOFlow" },
  { label: "Data",          tip: "Data da fatura conforme comunicada ao portal e-Fatura" },
  { label: "Valor",         tip: "Valor total da fatura com IVA incluído, comunicado ao AT" },
  { label: "Estado AT",     tip: "Estado no portal e-Fatura: Compra Registada (aceite pelo AT) · Não Considerado (rejeitado) · Doc. Contabilidade (em contabilidade) · Sem Associação (fornecedor não reconhecido)" },
]

export function EFaturaTab({ data }: { data: EFaturaPageData }) {
  const { efatura_docs } = data
  const router = useRouter()

  // Periodo por defeito: mes atual (1 -> hoje).
  const now = new Date()
  const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const monthTo = now.toISOString().slice(0, 10)

  const [atFilters, setAtFilters] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState(monthFrom)
  const [dateTo, setDateTo] = useState(monthTo)
  const [isPendingRefresh, startRefresh] = useTransition()
  const [isPendingHistory, startHistory] = useTransition()
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  const showTip = useCallback((e: React.MouseEvent<HTMLTableCellElement>, text: string) => {
    const r = e.currentTarget.getBoundingClientRect()
    setTooltip({ text, x: r.left + r.width / 2, y: r.bottom + 6 })
  }, [])

  const hideTip = useCallback(() => setTooltip(null), [])

  const filteredDocs = useMemo(() => {
    return efatura_docs.filter((d) => {
      if (atFilters.length > 0 && !(d.at_status !== null && atFilters.includes(d.at_status))) return false
      if (dateFrom && (!d.document_date || d.document_date < dateFrom)) return false
      if (dateTo && (!d.document_date || d.document_date > dateTo)) return false
      return true
    })
  }, [efatura_docs, atFilters, dateFrom, dateTo])

  function handleRefresh() {
    startRefresh(async () => {
      try {
        const res = await fetch("/api/efatura/refresh", { method: "POST" })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? "Erro ao atualizar e-Fatura")
          return
        }
        const { n8n_triggered, direct_fetched, direct_created, direct_updated, matched, at_communicated_updated } = json as {
          n8n_triggered: boolean
          direct_fetched: number
          direct_created: number
          direct_updated: number
          matched: number
          at_communicated_updated: number
        }
        const lines: string[] = []
        if (n8n_triggered) lines.push("dados frescos pedidos ao AT")
        if (typeof direct_fetched === "number" && direct_fetched > 0) {
          lines.push(
            direct_created > 0
              ? `${direct_created} documento${direct_created !== 1 ? "s" : ""} novo${direct_created !== 1 ? "s" : ""}`
              : "sem documentos novos",
          )
          if (direct_updated > 0) lines.push(`${direct_updated} já existente${direct_updated !== 1 ? "s" : ""}`)
        }
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

  function handleImportHistory() {
    const now = new Date()
    const year = now.getFullYear()
    const months = now.getMonth() + 1 // janeiro ao mes atual do ano corrente
    if (!confirm(`Importar o histórico de e-Fatura de ${year} (janeiro ao mês atual)?\n\nPode demorar até um minuto.`)) return
    startHistory(async () => {
      try {
        const res = await fetch("/api/efatura/refresh", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ months }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? "Erro ao importar histórico e-Fatura")
          return
        }
        const { direct_fetched, direct_created, direct_updated, matched, at_communicated_updated } = json as {
          direct_fetched: number
          direct_created: number
          direct_updated: number
          matched: number
          at_communicated_updated: number
        }
        const lines: string[] = []
        if (typeof direct_fetched === "number" && direct_fetched > 0) {
          lines.push(
            direct_created > 0
              ? `${direct_created} documento${direct_created !== 1 ? "s" : ""} novo${direct_created !== 1 ? "s" : ""}`
              : "sem documentos novos",
          )
          if (direct_updated > 0) lines.push(`${direct_updated} já existente${direct_updated !== 1 ? "s" : ""}`)
        }
        if (matched > 0) lines.push(`${matched} associada${matched !== 1 ? "s" : ""}`)
        if (at_communicated_updated > 0) lines.push(`${at_communicated_updated} marcada${at_communicated_updated !== 1 ? "s" : ""} AT`)
        toast.success("Histórico e-Fatura importado", {
          description: lines.length ? lines.join(" · ") : "Sem novos documentos",
        })
        router.refresh()
      } catch {
        toast.error("Erro de ligação ao servidor")
      }
    })
  }

  const exportBaseUrl = `/api/efatura/export${atFilters.length > 0 ? `?at_status=${encodeURIComponent(atFilters.join(","))}` : ""}`

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translateX(-50%)",
            zIndex: 9999,
            pointerEvents: "none",
            maxWidth: 320,
            background: "#111827",
            color: "#fff",
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            lineHeight: "1.5",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* ── Toolbar — filtros a' esquerda, acoes a' direita (padrao da tab Todas) */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtrar — Estado AT */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 bg-card border-border/60 shadow-sm">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filtrar
                {atFilters.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] px-1">
                    {atFilters.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-3 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Estado AT</label>
              {AT_STATUS_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={atFilters.includes(o.value)}
                    onCheckedChange={() =>
                      setAtFilters(
                        atFilters.includes(o.value)
                          ? atFilters.filter((v) => v !== o.value)
                          : [...atFilters, o.value],
                      )
                    }
                    className="h-3.5 w-3.5"
                  />
                  {o.label}
                </label>
              ))}
              {atFilters.length > 0 && (
                <button
                  onClick={() => setAtFilters([])}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  Limpar filtros
                </button>
              )}
            </PopoverContent>
          </Popover>

          {/* Periodo — datas agrupadas (mes atual por defeito) */}
          <div className="inline-flex items-center gap-1.5 h-9 px-2.5 bg-card border border-border/60 shadow-sm rounded-md">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-7 w-[120px] border-0 bg-transparent shadow-none px-1 focus-visible:ring-0"
              aria-label="Data início"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-7 w-[120px] border-0 bg-transparent shadow-none px-1 focus-visible:ring-0"
              aria-label="Data fim"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-9" onClick={handleImportHistory} disabled={isPendingHistory || isPendingRefresh}>
            {isPendingHistory
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <History className="mr-2 h-4 w-4" />
            }
            Importar histórico
          </Button>
          <Button size="sm" className="h-9" onClick={handleRefresh} disabled={isPendingRefresh || isPendingHistory}>
            {isPendingRefresh
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />
            }
            Atualizar
          </Button>
          <ExportDropdown exportUrl={exportBaseUrl} compact />
        </div>
      </div>

      {/* ── Tabela + arquivo — área com scroll ───────────────── */}
      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        {/* Documentos AT — thead sticky */}
        {filteredDocs.length === 0 ? (
          <EmptyState icon={FileText} title="Sem documentos pendentes" description="Todos os documentos AT já estão associados a faturas." />
        ) : (
          <div className="rounded-lg border border-border/60 bg-card overflow-auto shadow-[var(--shadow-card,none)]">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead className="w-10 text-center" />
                  <TableHead className="cursor-default select-none" onMouseEnter={(e) => showTip(e, HEADERS[0].tip)} onMouseLeave={hideTip}>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell cursor-default select-none" onMouseEnter={(e) => showTip(e, HEADERS[2].tip)} onMouseLeave={hideTip}>Data</TableHead>
                  <TableHead className="cursor-default select-none" onMouseEnter={(e) => showTip(e, HEADERS[3].tip)} onMouseLeave={hideTip}>Valor</TableHead>
                  <TableHead className="cursor-default select-none" onMouseEnter={(e) => showTip(e, HEADERS[4].tip)} onMouseLeave={hideTip}>Estado AT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="px-3 text-center">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium truncate">{doc.supplier_name ?? "Fornecedor desconhecido"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{doc.document_number ?? "—"}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{doc.document_date ? formatDate(doc.document_date) : "—"}</TableCell>
                    <TableCell className="tabular-nums font-medium">{doc.total !== null ? formatCurrency(doc.total!) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ATStatusBadge status={doc.at_status} />
                        {doc.invoice_id && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                            Conciliada
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card,none)] p-8 flex flex-col items-center text-center">
      <Icon className="h-8 w-8 text-muted-foreground mb-2" />
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
    </div>
  )
}
