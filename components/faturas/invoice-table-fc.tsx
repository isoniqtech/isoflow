"use client"

import { useState, useTransition, useCallback, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ChevronDown, FileText, Loader2, Mail, MessageCircle, Plus, Send, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/faturas/status-badge"
import { InvoiceFilters, type InvoiceFiltersValue } from "@/components/faturas/invoice-filters"
import { ExportDropdown } from "@/components/faturas/export-dropdown"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type { InvoiceListItem, ProjectOption as FilterProjectOption } from "@/lib/queries/invoices"
import type { InvoiceSource } from "@/types"

type ProjectOption = { id: string; name: string; color: string }

const SOURCE_ICONS: Record<InvoiceSource, typeof FileText> = {
  whatsapp: MessageCircle,
  email: Mail,
  manual: Upload,
  api: FileText,
  erp: FileText,
}

function BankBadge({ inv }: { inv: InvoiceListItem }) {
  if (inv.bank_transaction_id) {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">Conciliada</span>
  }
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">Por conciliar</span>
}

function ATBadge({ inv }: { inv: InvoiceListItem }) {
  if (inv.at_communicated) {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">Compra Registada</span>
  }
  if (inv.efatura_at_status) {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">Pendente AT</span>
  }
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">Por conciliar</span>
}

const TIPS: Record<string, string> = {
  supplier: "Nome e NIF do fornecedor da fatura",
  number:   "Numero de identificacao da fatura emitida pelo fornecedor",
  date:     "Data de emissao da fatura",
  erp:      "Numero do documento no TOCONLINE (Fatura de Compra)",
  project:  "Obra ou projeto ao qual esta fatura esta associada",
  value:    "Valor total da fatura com IVA incluido",
  status:   "Estado atual do processamento da fatura",
  bank:     "Indica se a fatura foi conciliada com um movimento bancario",
  at:       "Indica se a fatura esta registada na e-Fatura da Autoridade Tributaria",
}

export function InvoiceTableFC({
  invoices,
  canEdit = false,
  canCreate = false,
  exportUrl = null,
  filterProjects,
  filterValue,
}: {
  invoices: InvoiceListItem[]
  canEdit?: boolean
  canCreate?: boolean
  exportUrl?: string | null
  filterProjects: FilterProjectOption[]
  filterValue: InvoiceFiltersValue
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([])

  useEffect(() => {
    if (!canEdit) return
    fetch("/api/projetos")
      .then((r) => r.json())
      .then((body) => {
        const list = (body.data ?? []) as Array<{ id: string; name: string; color: string }>
        setProjects(list.map((p) => ({ id: p.id, name: p.name, color: p.color ?? "#2563EB" })))
      })
      .catch(() => {})
  }, [canEdit])

  async function handleProjectChange(invoiceId: string, projectId: string | null) {
    const res = await fetch(`/api/faturas/${invoiceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    })
    if (!res.ok) {
      toast.error("Erro ao atualizar projeto")
      return
    }
    router.refresh()
  }
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startPolling(invoiceIds: string[]) {
    let attempts = 0
    const MAX = 20 // max 60s (20 x 3s)
    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const res = await fetch(`/api/faturas/check-fc?ids=${invoiceIds.join(",")}`)
        if (res.ok) {
          const { allDone } = await res.json() as { allDone: boolean }
          if (allDone) {
            clearInterval(pollRef.current!)
            pollRef.current = null
            router.refresh()
            toast.success("FC criada no TOConline")
            return
          }
        }
      } catch { /* silencioso */ }
      if (attempts >= MAX) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        router.refresh()
      }
    }, 3000)
  }

  const showTip = useCallback((e: React.MouseEvent<HTMLTableCellElement>, key: string) => {
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ text: TIPS[key] ?? key, x: r.left + r.width / 2, y: r.bottom + 6 })
  }, [])
  const hideTip = useCallback(() => setTip(null), [])

  // Apenas faturas incoming sem FC e sem sync ERP são elegíveis
  const eligible = invoices.filter(i => i.type === "incoming" && !i.toconline_fc_id && !i.erp_synced)
  const allSelected = eligible.length > 0 && eligible.every(i => selected.has(i.id))
  const someSelected = selected.size > 0 && !allSelected

  function toggleAll(v: boolean) {
    setSelected(v ? new Set(eligible.map(i => i.id)) : new Set())
  }

  function toggle(id: string, v: boolean) {
    setSelected(prev => {
      const n = new Set(prev)
      v ? n.add(id) : n.delete(id)
      return n
    })
  }

  function handleCreateFC() {
    if (!selected.size) return
    const ids = Array.from(selected)
    startTransition(async () => {
      try {
        const res = await fetch("/api/faturas/create-fc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_ids: ids }),
        })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? "Erro ao criar FC"); return }
        const { queued, skipped, errors } = json as { queued: number; skipped: number; errors?: string[] }
        if (errors?.length) {
          toast.error(`Erro ao enviar: ${errors[0]}`)
          return
        }
        toast.success(`${queued} fatura${queued !== 1 ? "s" : ""} enviada${queued !== 1 ? "s" : ""} ao ERP${skipped ? ` (${skipped} já processadas)` : ""} - a aguardar confirmação...`)
        setSelected(new Set())
        if (queued > 0) startPolling(ids)
      } catch { toast.error("Erro de ligação ao servidor") }
    })
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {tip && (
        <div style={{ position: "fixed", left: tip.x, top: tip.y, transform: "translateX(-50%)", zIndex: 9999, pointerEvents: "none", whiteSpace: "nowrap", background: "#111827", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", lineHeight: "1.5", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
          {tip.text}
        </div>
      )}
      {/* Filtros + acoes — mesma linha, sempre visivel (sticky no topo).
          Ordem a' direita: Nova fatura | Enviar ao ERP | menu (Exportar). */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2">
        <InvoiceFilters value={filterValue} projects={filterProjects} />
        <div className="flex items-center gap-2 shrink-0">
          {canCreate && (
            <Button size="sm" className="h-9" asChild>
              <Link href="/faturas/nova">
                <Plus className="mr-2 h-4 w-4" />
                Nova fatura
              </Link>
            </Button>
          )}
          {eligible.length > 0 && (
            <Button
              size="sm"
              className="h-9"
              onClick={handleCreateFC}
              disabled={isPending || selected.size === 0}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar ao ERP{selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
          )}
          {exportUrl && <ExportDropdown exportUrl={exportUrl} compact />}
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="flex-1 border border-border/60 rounded-lg p-12 flex flex-col items-center text-center bg-card shadow-[var(--shadow-card,none)]">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <h2 className="font-semibold mb-1">Sem faturas para mostrar</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Quando enviares faturas via WhatsApp, email ou upload manual, vão aparecer aqui.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 rounded-lg border border-border/60 bg-card overflow-auto shadow-[var(--shadow-card,none)]">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
              <TableHead className="w-10">
                {eligible.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected }}
                    onChange={e => toggleAll(e.target.checked)}
                    aria-label="Selecionar todas"
                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  />
                )}
              </TableHead>
              <TableHead className="cursor-default" onMouseEnter={e => showTip(e, "supplier")} onMouseLeave={hideTip}>Fornecedor</TableHead>
              <TableHead className="hidden md:table-cell cursor-default" onMouseEnter={e => showTip(e, "date")} onMouseLeave={hideTip}>Data</TableHead>
              <TableHead className="hidden lg:table-cell cursor-default" onMouseEnter={e => showTip(e, "erp")} onMouseLeave={hideTip}>FC ERP</TableHead>
              <TableHead className="hidden md:table-cell cursor-default" onMouseEnter={e => showTip(e, "project")} onMouseLeave={hideTip}>Projeto</TableHead>
              <TableHead className="text-right cursor-default" onMouseEnter={e => showTip(e, "value")} onMouseLeave={hideTip}>Valor</TableHead>
              <TableHead className="cursor-default" onMouseEnter={e => showTip(e, "status")} onMouseLeave={hideTip}>Estado</TableHead>
              <TableHead className="hidden xl:table-cell cursor-default" onMouseEnter={e => showTip(e, "bank")} onMouseLeave={hideTip}>Bancario</TableHead>
              <TableHead className="hidden xl:table-cell cursor-default" onMouseEnter={e => showTip(e, "at")} onMouseLeave={hideTip}>AT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const SourceIcon = SOURCE_ICONS[inv.source] ?? FileText
              const isEligible = inv.type === "incoming" && !inv.toconline_fc_id
              const isSelected = selected.has(inv.id)
              return (
                <TableRow key={inv.id} className={cn("cursor-pointer", isSelected && "bg-muted/40")}>
                  <TableCell className="px-3">
                    {isEligible ? (
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => toggle(inv.id, e.target.checked)}
                          aria-label={`Selecionar ${inv.supplier_name ?? inv.id}`}
                          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                        />
                      </span>
                    ) : (
                      <Link href={`/faturas/${inv.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <SourceIcon className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/faturas/${inv.id}`} className="block">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{inv.supplier_name ?? "Fornecedor desconhecido"}</span>
                        {inv.needs_review && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-label="Necessita revisão" />}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{inv.invoice_number ?? "—"}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.invoice_date ? formatDate(inv.invoice_date) : "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono text-sm">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.toconline_fc_id
                        ? <span className="text-foreground">{inv.toconline_fc_id}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                    {canEdit ? (
                      <Select
                        value={inv.project?.id ?? "none"}
                        onValueChange={(v) =>
                          handleProjectChange(inv.id, v === "none" ? null : v)
                        }
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none px-1 gap-1 w-auto max-w-[160px] focus:ring-0 hover:bg-muted/50 rounded">
                          {inv.project ? (
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: inv.project.color }} />
                              <span className="truncate">{inv.project.name}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Sem projeto</span>
                          )}
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground text-xs">Sem projeto</span>
                          </SelectItem>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                {p.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Link href={`/faturas/${inv.id}`} className="block">
                        {inv.project
                          ? <Badge variant="outline" className="font-normal" style={{ borderColor: inv.project.color, color: inv.project.color }}>{inv.project.name}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.total !== null ? formatCurrency(inv.total) : "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/faturas/${inv.id}`} className="block"><StatusBadge status={inv.status} /></Link>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <Link href={`/faturas/${inv.id}`} className="block"><BankBadge inv={inv} /></Link>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <Link href={`/faturas/${inv.id}`} className="block"><ATBadge inv={inv} /></Link>
                  </TableCell>
                </TableRow>
              )
            })}
                </TableBody>
            </table>
          </div>
      )}
    </div>
  )
}
