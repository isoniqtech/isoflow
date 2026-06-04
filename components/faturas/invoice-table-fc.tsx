"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { AlertTriangle, FileText, Loader2, Mail, MessageCircle, Send, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/faturas/status-badge"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type { InvoiceListItem } from "@/lib/queries/invoices"
import type { InvoiceSource } from "@/types"

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
  return <span className="text-xs text-muted-foreground">Por conciliar</span>
}

function ATBadge({ inv }: { inv: InvoiceListItem }) {
  if (inv.at_communicated) {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">Compra Registada</span>
  }
  if (inv.toconline_fc_id) {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">Sem associação</span>
  }
  return <span className="text-xs text-muted-foreground">Sem FC</span>
}

export function InvoiceTableFC({ invoices }: { invoices: InvoiceListItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  // Apenas faturas incoming sem FC são elegíveis
  const eligible = invoices.filter(i => i.type === "incoming" && !i.toconline_fc_id)
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
    startTransition(async () => {
      try {
        const res = await fetch("/api/faturas/create-fc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_ids: Array.from(selected) }),
        })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? "Erro ao criar FC"); return }
        const { queued, skipped } = json as { queued: number; skipped: number }
        toast.success(`${queued} fatura${queued !== 1 ? "s" : ""} enviada${queued !== 1 ? "s" : ""} ao ERP${skipped ? ` (${skipped} já processadas)` : ""}`)
        setSelected(new Set())
      } catch { toast.error("Erro de ligação ao servidor") }
    })
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {invoices.length === 0 ? (
        <div className="flex-1 border rounded-lg p-12 flex flex-col items-center text-center bg-background">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <h2 className="font-semibold mb-1">Sem faturas para mostrar</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Quando enviares faturas via WhatsApp, email ou upload manual, vão aparecer aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Barra ERP — estática */}
          <div className="flex-shrink-0 flex items-center justify-between px-1 min-h-[32px]">
            <p className="text-sm text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selecionada${selected.size !== 1 ? "s" : ""}` : ""}
            </p>
            <Button size="sm" onClick={handleCreateFC} disabled={isPending || selected.size === 0}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar ao ERP{selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
          </div>

          {/* Tabela — thead sticky, tbody scrollável */}
          <div className="flex-1 min-h-0 rounded-lg border bg-background overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-background">
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
              <TableHead>Fornecedor</TableHead>
              <TableHead className="hidden md:table-cell">Nº Fatura</TableHead>
              <TableHead className="hidden lg:table-cell">Data</TableHead>
              <TableHead className="hidden lg:table-cell">FC ERP</TableHead>
              <TableHead className="hidden md:table-cell">Projeto</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden xl:table-cell">Bancário</TableHead>
              <TableHead className="hidden xl:table-cell">AT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const SourceIcon = SOURCE_ICONS[inv.source] ?? FileText
              const isEligible = inv.type === "incoming" && !inv.toconline_fc_id
              const isSelected = selected.has(inv.id)
              const overdue = inv.due_date && inv.status !== "paid" && inv.status !== "rejected" && new Date(inv.due_date) < new Date()

              return (
                <TableRow key={inv.id} className={cn("cursor-pointer", isSelected && "bg-muted/40")}>
                  <TableCell className="px-3">
                    {isEligible ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => toggle(inv.id, e.target.checked)}
                        aria-label={`Selecionar ${inv.supplier_name ?? inv.id}`}
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      />
                    ) : (
                      <Link href={`/faturas/${inv.id}`} className="block">
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
                      {inv.supplier_nif && <p className="text-xs text-muted-foreground font-mono">{inv.supplier_nif}</p>}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-sm">
                    <Link href={`/faturas/${inv.id}`} className="block">{inv.invoice_number ?? "—"}</Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      <span className={cn(overdue && "text-destructive font-medium")}>
                        {inv.invoice_date ? formatDate(inv.invoice_date) : "—"}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono text-sm">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.toconline_fc_id
                        ? <span className="text-foreground">{inv.toconline_fc_id}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.project
                        ? <Badge variant="outline" className="font-normal" style={{ borderColor: inv.project.color, color: inv.project.color }}>{inv.project.name}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </Link>
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
        </>
      )}
    </div>
  )
}
