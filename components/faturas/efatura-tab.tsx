"use client"

import { useState, useTransition, useMemo } from "react"
import { CheckCircle2, FileText, Loader2, Link2, Zap } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { EFaturaPageData, EFaturaDocument, EFaturaInvoiceItem } from "@/lib/queries/efatura-documents"
import type { InvoiceStatus } from "@/types"

// ── Filtros possíveis para a esquerda ───────────────────────────────────────

type LeftFilter = "sem_at" | "sem_fc" | "todas"

const STATUS_FILTER_OPTIONS: { value: InvoiceStatus | "todas"; label: string }[] = [
  { value: "todas",             label: "Todos os estados" },
  { value: "em_sistema",        label: "Em Sistema" },
  { value: "necessita_revisao", label: "Necessita Revisão" },
  { value: "enviada_erp",       label: "Enviada ERP" },
  { value: "rejected",          label: "Rejeitada" },
  { value: "duplicate",         label: "Duplicada" },
]

const AT_STATUS_OPTIONS = [
  { value: "todas",               label: "Todos os estados" },
  { value: "Pendente",            label: "Pendente" },
  { value: "Associada",           label: "Compra Registada" },
  { value: "compra_registada",    label: "Compra Registada (AT)" },
  { value: "doc_contabilidade",   label: "Doc. Contabilidade" },
  { value: "nao_considerado",     label: "Não Considerado" },
]

// ── AT status badge ──────────────────────────────────────────────────────────

function ATStatusBadge({ status }: { status: string | null }) {
  if (status === "compra_registada" || status === "Associada") {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">Compra Registada</span>
  }
  if (status === "doc_contabilidade") {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Doc. na Contabilidade</span>
  }
  if (status === "nao_considerado") {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">Não considerado</span>
  }
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">{status === "Pendente" ? "Pendente" : "Sem associação"}</span>
}

function FCBadge({ inv }: { inv: EFaturaInvoiceItem }) {
  if (inv.efatura_doc_number) {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 font-mono">{inv.efatura_doc_number}</span>
  }
  if (!inv.toconline_fc_id) {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">FC por criar</span>
  }
  return <span className="text-xs text-muted-foreground font-mono">FC {inv.toconline_fc_id}</span>
}

// ── Main component ───────────────────────────────────────────────────────────

export function EFaturaTab({ data }: { data: EFaturaPageData }) {
  const { invoices, efatura_docs, efatura_docs_matched } = data

  const [leftFilter, setLeftFilter] = useState<LeftFilter>("sem_at")
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todas">("todas")
  const [docAtFilter, setDocAtFilter] = useState<string>("todas")
  const [showMatched, setShowMatched] = useState(false)
  const [selectedInv, setSelectedInv] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [isPendingMatch, startMatch] = useTransition()
  const [isPendingAuto, startAuto] = useTransition()

  const filteredInvoices = useMemo(() => {
    let list = invoices
    if (leftFilter === "sem_at") list = list.filter(i => !i.efatura_doc_id)
    else if (leftFilter === "sem_fc") list = list.filter(i => !i.toconline_fc_id)
    if (statusFilter !== "todas") list = list.filter(i => i.status === statusFilter)
    return list
  }, [invoices, leftFilter, statusFilter])

  const filteredDocs = useMemo(() => {
    if (docAtFilter === "todas") return efatura_docs
    return efatura_docs.filter(d => d.at_status === docAtFilter)
  }, [efatura_docs, docAtFilter])

  function handleAutoMatch() {
    startAuto(async () => {
      try {
        const res = await fetch("/api/efatura/auto-match", { method: "POST" })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? "Erro ao auto-conciliar"); return }
        toast.success(`${json.matched} fatura${json.matched !== 1 ? "s" : ""} conciliada${json.matched !== 1 ? "s" : ""} automaticamente`)
        window.location.reload()
      } catch { toast.error("Erro de ligação ao servidor") }
    })
  }

  function handleMatch() {
    if (!selectedInv || !selectedDoc) return
    startMatch(async () => {
      try {
        const res = await fetch("/api/efatura/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_id: selectedInv, efatura_doc_id: selectedDoc }),
        })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? "Erro ao associar"); return }
        toast.success("Associação guardada.")
        setSelectedInv(null)
        setSelectedDoc(null)
        window.location.reload()
      } catch { toast.error("Erro de ligação ao servidor") }
    })
  }

  const canMatch = selectedInv !== null && selectedDoc !== null

  return (
    <div className="space-y-6">

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtros esquerda — tipo */}
          {(["sem_at", "sem_fc", "todas"] as LeftFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setLeftFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                leftFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "sem_at" ? "Sem AT" : f === "sem_fc" ? "Sem FC" : "Todas"}
              <span className="ml-1.5 opacity-70">
                ({f === "sem_at"
                  ? invoices.filter(i => !i.efatura_doc_id).length
                  : f === "sem_fc"
                  ? invoices.filter(i => !i.toconline_fc_id).length
                  : invoices.length})
              </span>
            </button>
          ))}
          {/* Filtro por estado da fatura */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus | "todas")}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {canMatch && (
            <Button size="sm" onClick={handleMatch} disabled={isPendingMatch}>
              {isPendingMatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Associar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleAutoMatch} disabled={isPendingAuto}>
            {isPendingAuto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Auto-conciliar
          </Button>
        </div>
      </div>

      {/* ── Split view ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Esquerda — faturas */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Faturas ({filteredInvoices.length})
          </p>
          {filteredInvoices.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Tudo conciliado" description="Todas as faturas têm correspondência no e-Fatura." />
          ) : (
            <div className="rounded-lg border bg-background divide-y overflow-hidden">
              {filteredInvoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => setSelectedInv(selectedInv === inv.id ? null : inv.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedInv === inv.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{inv.supplier_name ?? "Fornecedor desconhecido"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{inv.invoice_number ?? "—"}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-sm font-medium tabular-nums">{inv.total !== null ? formatCurrency(inv.total) : "—"}</p>
                      <FCBadge inv={inv} />
                    </div>
                  </div>
                  {inv.invoice_date && (
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(inv.invoice_date)}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Direita — documentos e-Fatura não conciliados */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Documentos e-Fatura AT — por conciliar ({filteredDocs.length}{filteredDocs.length !== efatura_docs.length ? `/${efatura_docs.length}` : ""})
            </p>
            <Select value={docAtFilter} onValueChange={setDocAtFilter}>
              <SelectTrigger className="h-7 text-xs w-44">
                <SelectValue placeholder="Estado AT" />
              </SelectTrigger>
              <SelectContent>
                {AT_STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredDocs.length === 0 ? (
            <EmptyState icon={FileText} title="Sem documentos pendentes" description="Todos os documentos AT já estão conciliados." />
          ) : (
            <div className="rounded-lg border bg-background divide-y overflow-hidden">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedDoc === doc.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{doc.supplier_name ?? "Fornecedor desconhecido"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{doc.document_number ?? "—"}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-sm font-medium tabular-nums">{doc.total !== null ? formatCurrency(doc.total!) : "—"}</p>
                      <ATStatusBadge status={doc.at_status} />
                    </div>
                  </div>
                  {doc.document_date && (
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(doc.document_date)}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {canMatch && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <Link2 className="h-4 w-4 shrink-0" />
          <span>Após associar, lembra-te de registar a compra manualmente no Toconline.</span>
        </div>
      )}

      {/* ── Compras Registadas (arquivo) ──────────────────── */}
      {efatura_docs_matched.length > 0 && (
        <section>
          <button
            onClick={() => setShowMatched(v => !v)}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showMatched ? "▲" : "▶"} Compras Registadas ({efatura_docs_matched.length})
          </button>
          {showMatched && (
            <div className="mt-3 rounded-lg border bg-background overflow-x-auto">
              <Table>
                <TableHeader>
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
              </Table>
            </div>
          )}
        </section>
      )}
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
