"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, FileText, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { EFaturaData, InvoiceListItem } from "@/lib/queries/invoices"

export function EFaturaTab({ data }: { data: EFaturaData }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const { por_enviar, enviadas } = data

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(por_enviar.map((i) => i.id)) : new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleSend() {
    if (!selected.size) return
    startTransition(async () => {
      try {
        const res = await fetch("/api/faturas/send-at", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_ids: Array.from(selected) }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? "Erro ao enviar para AT")
          return
        }
        const { sent, skipped, errors } = json as {
          sent: number
          skipped: number
          errors: string[]
        }
        if (errors.length) {
          toast.warning(
            `${sent} enviadas, ${errors.length} erros: ${errors[0]}`,
          )
        } else {
          toast.success(
            `${sent} fatura${sent !== 1 ? "s" : ""} enviada${sent !== 1 ? "s" : ""} ao AT com sucesso` +
              (skipped ? ` (${skipped} já enviadas)` : ""),
          )
        }
        setSelected(new Set())
        // Refresh the page data
        window.location.reload()
      } catch {
        toast.error("Erro de ligação ao servidor")
      }
    })
  }

  const allSelected = por_enviar.length > 0 && selected.size === por_enviar.length
  const someSelected = selected.size > 0 && !allSelected

  return (
    <div className="space-y-6">
      {/* Por enviar */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">Por enviar ao AT</h2>
            <p className="text-xs text-muted-foreground">
              Faturas sincronizadas com o ERP mas ainda não comunicadas à Autoridade Tributária
            </p>
          </div>
          {selected.size > 0 && (
            <Button size="sm" onClick={handleSend} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar ao AT ({selected.size})
            </Button>
          )}
        </div>

        {por_enviar.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Tudo comunicado"
            description="Não há faturas pendentes de envio para a AT."
          />
        ) : (
          <div className="rounded-lg border bg-background overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected
                      }}
                      onChange={(e) => toggleAll(e.target.checked)}
                      aria-label="Selecionar todas"
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    />
                  </TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">Nº Fatura</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {por_enviar.map((inv) => (
                  <InvoiceSelectRow
                    key={inv.id}
                    inv={inv}
                    checked={selected.has(inv.id)}
                    onCheckedChange={(v) => toggleOne(inv.id, v)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Enviadas */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold">Comunicadas à AT</h2>
          <p className="text-xs text-muted-foreground">
            Faturas já enviadas ao e-Fatura
          </p>
        </div>

        {enviadas.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sem registos"
            description="Ainda não foram enviadas faturas para a AT."
          />
        ) : (
          <div className="rounded-lg border bg-background overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">Nº Fatura</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead>AT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enviadas.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <p className="font-medium truncate">
                        {inv.supplier_name ?? "Fornecedor desconhecido"}
                      </p>
                      {inv.supplier_nif && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {inv.supplier_nif}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-sm">
                      {inv.invoice_number ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {inv.invoice_date ? formatDate(inv.invoice_date) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {inv.total !== null ? formatCurrency(inv.total) : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {inv.type === "outgoing" ? "Emitida" : "Recebida"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                        Enviada
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

function InvoiceSelectRow({
  inv,
  checked,
  onCheckedChange,
}: {
  inv: InvoiceListItem
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <TableRow className={checked ? "bg-muted/40" : undefined}>
      <TableCell className="px-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          aria-label={`Selecionar ${inv.supplier_name ?? inv.id}`}
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
        />
      </TableCell>
      <TableCell>
        <p className="font-medium truncate">
          {inv.supplier_name ?? "Fornecedor desconhecido"}
        </p>
        {inv.supplier_nif && (
          <p className="text-xs text-muted-foreground font-mono">{inv.supplier_nif}</p>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell font-mono text-sm">
        {inv.invoice_number ?? "—"}
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm">
        {inv.invoice_date ? formatDate(inv.invoice_date) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {inv.total !== null ? formatCurrency(inv.total) : "—"}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
        {inv.type === "outgoing" ? "Emitida" : "Recebida"}
      </TableCell>
    </TableRow>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText
  title: string
  description: string
}) {
  return (
    <div className="border rounded-lg p-8 flex flex-col items-center text-center bg-background">
      <Icon className="h-8 w-8 text-muted-foreground mb-2" />
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
    </div>
  )
}
