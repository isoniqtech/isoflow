"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, FileText, Loader2, Send, FilePlus } from "lucide-react"
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

// ── AT state badge ──────────────────────────────────────────────────────────

function ATBadge({ inv }: { inv: InvoiceListItem }) {
  if (inv.at_communicated) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
        ✅ Associada AT
      </span>
    )
  }
  if (inv.toconline_fc_id) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        FC {inv.toconline_fc_id}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
      Sem FC
    </span>
  )
}

// ── Checkbox helper ─────────────────────────────────────────────────────────

function Cb({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate ?? false
      }}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
    />
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function EFaturaTab({ data }: { data: EFaturaData }) {
  // FC creation selection (all invoices without FC)
  const [fcSelected, setFcSelected] = useState<Set<string>>(new Set())
  const [isPendingFC, startFC] = useTransition()

  // AT send selection (invoices with FC but not yet at_communicated)
  const [atSelected, setAtSelected] = useState<Set<string>>(new Set())
  const [isPendingAT, startAT] = useTransition()

  const { por_enviar, enviadas } = data

  // Invoices sem FC
  const semFC = por_enviar.filter((i) => !i.toconline_fc_id)
  // Invoices com FC mas ainda não comunicadas AT
  const comFC = por_enviar.filter((i) => i.toconline_fc_id && !i.at_communicated)

  // ── FC bulk select ──
  const fcAllSelected = semFC.length > 0 && fcSelected.size === semFC.length
  const fcSomeSelected = fcSelected.size > 0 && !fcAllSelected

  function toggleAllFC(v: boolean) {
    setFcSelected(v ? new Set(semFC.map((i) => i.id)) : new Set())
  }
  function toggleOneFC(id: string, v: boolean) {
    setFcSelected((prev) => {
      const next = new Set(prev)
      v ? next.add(id) : next.delete(id)
      return next
    })
  }

  // ── AT bulk select ──
  const atAllSelected = comFC.length > 0 && atSelected.size === comFC.length
  const atSomeSelected = atSelected.size > 0 && !atAllSelected

  function toggleAllAT(v: boolean) {
    setAtSelected(v ? new Set(comFC.map((i) => i.id)) : new Set())
  }
  function toggleOneAT(id: string, v: boolean) {
    setAtSelected((prev) => {
      const next = new Set(prev)
      v ? next.add(id) : next.delete(id)
      return next
    })
  }

  // ── Criar FC ──
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
        if (!res.ok) {
          toast.error(json.error ?? "Erro ao criar FC no Toconline")
          return
        }
        const { created, skipped, errors } = json as {
          created: number
          skipped: number
          errors: string[]
        }
        if (errors.length) {
          toast.warning(`${created} FCs criadas, ${errors.length} erros: ${errors[0]}`)
        } else {
          toast.success(
            `${created} FC${created !== 1 ? "s" : ""} criada${created !== 1 ? "s" : ""} no Toconline` +
              (skipped ? ` (${skipped} já tinham FC)` : ""),
          )
        }
        setFcSelected(new Set())
        window.location.reload()
      } catch {
        toast.error("Erro de ligação ao servidor")
      }
    })
  }

  // ── Enviar AT ──
  function handleSendAT() {
    if (!atSelected.size) return
    startAT(async () => {
      try {
        const res = await fetch("/api/faturas/send-at", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_ids: Array.from(atSelected) }),
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
          toast.warning(`${sent} enviadas, ${errors.length} erros: ${errors[0]}`)
        } else {
          toast.success(
            `${sent} fatura${sent !== 1 ? "s" : ""} enviada${sent !== 1 ? "s" : ""} ao AT` +
              (skipped ? ` (${skipped} já enviadas)` : ""),
          )
        }
        setAtSelected(new Set())
        window.location.reload()
      } catch {
        toast.error("Erro de ligação ao servidor")
      }
    })
  }

  return (
    <div className="space-y-8">

      {/* ── SECÇÃO 1: Sem FC ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">1. Criar FC no Toconline</h2>
            <p className="text-xs text-muted-foreground">
              Faturas sem Fatura de Compra associada no Toconline
            </p>
          </div>
          {fcSelected.size > 0 && (
            <Button size="sm" onClick={handleCreateFC} disabled={isPendingFC}>
              {isPendingFC ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FilePlus className="mr-2 h-4 w-4" />
              )}
              Criar FC no Toconline ({fcSelected.size})
            </Button>
          )}
        </div>

        {semFC.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Todas as faturas têm FC"
            description="Não há faturas sem Fatura de Compra associada."
          />
        ) : (
          <div className="rounded-lg border bg-background overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Cb
                      checked={fcAllSelected}
                      indeterminate={fcSomeSelected}
                      onChange={toggleAllFC}
                      label="Selecionar todas sem FC"
                    />
                  </TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">Nº Fatura</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Estado AT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {semFC.map((inv) => (
                  <SelectRow
                    key={inv.id}
                    inv={inv}
                    checked={fcSelected.has(inv.id)}
                    onCheckedChange={(v) => toggleOneFC(inv.id, v)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── SECÇÃO 2: Com FC, por enviar AT ─────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">2. Enviar ao AT (e-Fatura)</h2>
            <p className="text-xs text-muted-foreground">
              Faturas com FC criada no Toconline, ainda não comunicadas à AT
            </p>
          </div>
          {atSelected.size > 0 && (
            <Button size="sm" onClick={handleSendAT} disabled={isPendingAT}>
              {isPendingAT ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar ao AT ({atSelected.size})
            </Button>
          )}
        </div>

        {comFC.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Sem pendentes para enviar"
            description="Todas as FCs criadas já foram comunicadas à AT."
          />
        ) : (
          <div className="rounded-lg border bg-background overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Cb
                      checked={atAllSelected}
                      indeterminate={atSomeSelected}
                      onChange={toggleAllAT}
                      label="Selecionar todas para enviar AT"
                    />
                  </TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">Nº Fatura</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>FC Toconline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comFC.map((inv) => (
                  <SelectRow
                    key={inv.id}
                    inv={inv}
                    checked={atSelected.has(inv.id)}
                    onCheckedChange={(v) => toggleOneAT(inv.id, v)}
                    fcLabel={inv.toconline_fc_id ?? undefined}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── SECÇÃO 3: Comunicadas AT ─────────────────────────── */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold">3. Comunicadas à AT</h2>
          <p className="text-xs text-muted-foreground">
            Faturas já associadas ao e-Fatura
          </p>
        </div>

        {enviadas.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sem registos"
            description="Ainda não foram comunicadas faturas à AT."
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
                  <TableHead>Estado AT</TableHead>
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
                    <TableCell>
                      <ATBadge inv={inv} />
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

// ── Sub-components ──────────────────────────────────────────────────────────

function SelectRow({
  inv,
  checked,
  onCheckedChange,
  fcLabel,
}: {
  inv: InvoiceListItem
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  fcLabel?: string
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
      <TableCell>
        {fcLabel ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            FC {fcLabel}
          </span>
        ) : (
          <ATBadge inv={inv} />
        )}
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
