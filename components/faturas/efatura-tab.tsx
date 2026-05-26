"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, FileText, FilePlus, Loader2, Link2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { EFaturaPageData, EFaturaDocument } from "@/lib/queries/efatura-documents"
import type { InvoiceListItem } from "@/lib/queries/invoices"

// ── Checkbox helper ──────────────────────────────────────────────────────────

function Cb({ checked, indeterminate, onChange, label }: {
  checked: boolean; indeterminate?: boolean
  onChange: (v: boolean) => void; label: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = indeterminate ?? false }}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
    />
  )
}

// ── AT status badge ──────────────────────────────────────────────────────────

function ATStatusBadge({ status }: { status: string | null }) {
  if (status === "compra_registada") {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">Compra Registada</span>
  }
  if (status === "doc_contabilidade") {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Doc. na Contabilidade</span>
  }
  if (status === "nao_considerado") {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">Não considerado</span>
  }
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">Sem associação</span>
}

// ── Main component ───────────────────────────────────────────────────────────

export function EFaturaTab({ data }: { data: EFaturaPageData }) {
  const { sem_fc, com_fc, associadas, efatura_docs } = data

  // Secção 1 — criar FC
  const [fcSelected, setFcSelected] = useState<Set<string>>(new Set())
  const [isPendingFC, startFC] = useTransition()

  const fcAll = sem_fc.length > 0 && fcSelected.size === sem_fc.length
  const fcSome = fcSelected.size > 0 && !fcAll
  function toggleAllFC(v: boolean) { setFcSelected(v ? new Set(sem_fc.map(i => i.id)) : new Set()) }
  function toggleFC(id: string, v: boolean) {
    setFcSelected(prev => { const n = new Set(prev); v ? n.add(id) : n.delete(id); return n })
  }

  // Secção 2 — associar ao e-Fatura (match manual)
  const [selectedInv, setSelectedInv] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [isPendingMatch, startMatch] = useTransition()

  function handleCreateFC() {
    if (!fcSelected.size) return
    startFC(async () => {
      try {
        const res = await fetch("/api/faturas/create-fc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_ids: Array.from(fcSelected) }),
        })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? "Erro ao criar FC"); return }
        const { created, skipped, errors } = json as { created: number; skipped: number; errors: string[] }
        if (errors.length) toast.warning(`${created} FCs criadas, ${errors.length} erros: ${errors[0]}`)
        else toast.success(`${created} FC${created !== 1 ? "s" : ""} criada${created !== 1 ? "s" : ""} no Toconline${skipped ? ` (${skipped} já tinham FC)` : ""}`)
        setFcSelected(new Set())
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
        toast.success("Associação guardada. Regista a compra manualmente no Toconline.")
        setSelectedInv(null)
        setSelectedDoc(null)
        window.location.reload()
      } catch { toast.error("Erro de ligação ao servidor") }
    })
  }

  const canMatch = selectedInv !== null && selectedDoc !== null

  return (
    <div className="space-y-8">

      {/* ── PASSO 1: Criar FC ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">1. Criar FC no Toconline</h2>
            <p className="text-xs text-muted-foreground">Faturas sem Fatura de Compra associada</p>
          </div>
          {fcSelected.size > 0 && (
            <Button size="sm" onClick={handleCreateFC} disabled={isPendingFC}>
              {isPendingFC ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus className="mr-2 h-4 w-4" />}
              Criar FC no Toconline ({fcSelected.size})
            </Button>
          )}
        </div>

        {sem_fc.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Todas as faturas têm FC" description="Não há faturas sem Fatura de Compra associada." />
        ) : (
          <div className="rounded-lg border bg-background overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Cb checked={fcAll} indeterminate={fcSome} onChange={toggleAllFC} label="Selecionar todas" />
                  </TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">Nº Fatura</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sem_fc.map((inv) => (
                  <TableRow key={inv.id} className={fcSelected.has(inv.id) ? "bg-muted/40" : undefined}>
                    <TableCell className="px-3">
                      <input type="checkbox" checked={fcSelected.has(inv.id)}
                        onChange={(e) => toggleFC(inv.id, e.target.checked)}
                        aria-label={`Selecionar ${inv.supplier_name ?? inv.id}`}
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer" />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium truncate">{inv.supplier_name ?? "Fornecedor desconhecido"}</p>
                      {inv.supplier_nif && <p className="text-xs text-muted-foreground font-mono">{inv.supplier_nif}</p>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-sm">{inv.invoice_number ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{inv.invoice_date ? formatDate(inv.invoice_date) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{inv.total !== null ? formatCurrency(inv.total) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── PASSO 2: Associar FC com e-Fatura (split view) ───── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">2. Associar com movimento e-Fatura</h2>
            <p className="text-xs text-muted-foreground">
              Seleciona uma fatura (esquerda) e o documento AT correspondente (direita) e clica em Associar.
              Após associar, regista a compra manualmente no Toconline.
            </p>
          </div>
          {canMatch && (
            <Button size="sm" onClick={handleMatch} disabled={isPendingMatch}>
              {isPendingMatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Associar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Esquerda — faturas com FC */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Faturas com FC ({com_fc.length})
            </p>
            {com_fc.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Sem pendentes" description="Todas as FCs já estão associadas ao e-Fatura." />
            ) : (
              <div className="rounded-lg border bg-background divide-y overflow-hidden">
                {com_fc.map((inv) => (
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
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium tabular-nums">{inv.total !== null ? formatCurrency(inv.total) : "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">FC {inv.toconline_fc_id}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Direita — documentos e-Fatura */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Documentos e-Fatura AT ({efatura_docs.length})
            </p>
            {efatura_docs.length === 0 ? (
              <EmptyState icon={FileText} title="Sem documentos AT" description="Sincroniza os documentos e-Fatura via Toconline para os ver aqui." />
            ) : (
              <div className="rounded-lg border bg-background divide-y overflow-hidden">
                {efatura_docs.map((doc) => (
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
                      <div className="text-right shrink-0">
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
          <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0" />
            <span>
              Após associar, a fatura ficará marcada como <strong>Compra Registada — pendente manual no Toconline</strong>. Lembra-te de registar a compra manualmente no Toconline.
            </span>
          </div>
        )}
      </section>

      {/* ── ARQUIVO: Já associadas ────────────────────────────── */}
      {associadas.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-base font-semibold">Compras Registadas</h2>
            <p className="text-xs text-muted-foreground">Faturas já associadas ao e-Fatura</p>
          </div>
          <div className="rounded-lg border bg-background overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">Nº Fatura</TableHead>
                  <TableHead className="hidden md:table-cell">FC</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Estado AT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {associadas.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <p className="font-medium truncate">{inv.supplier_name ?? "Fornecedor desconhecido"}</p>
                      {inv.supplier_nif && <p className="text-xs text-muted-foreground font-mono">{inv.supplier_nif}</p>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-sm">{inv.invoice_number ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-sm">{inv.toconline_fc_id ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{inv.invoice_date ? formatDate(inv.invoice_date) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{inv.total !== null ? formatCurrency(inv.total) : "—"}</TableCell>
                    <TableCell><ATStatusBadge status="compra_registada" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
