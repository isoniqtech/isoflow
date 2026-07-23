"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ChevronDown, FileText, Mail, MessageCircle, Upload } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { InvoiceListItem } from "@/lib/queries/invoices"
import type { InvoiceSource } from "@/types"

type ProjectOption = { id: string; name: string; color: string }

const SOURCE_ICONS: Record<InvoiceSource, typeof FileText> = {
  whatsapp: MessageCircle,
  email: Mail,
  manual: Upload,
  api: FileText,
  erp: FileText,
}

const SOURCE_LABELS: Record<InvoiceSource, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  manual: "Manual",
  api: "API",
  erp: "ERP",
}

function BankBadge({ inv }: { inv: InvoiceListItem }) {
  if (inv.bank_transaction_id) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
        Conciliada
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">Por conciliar</span>
  )
}

function ATBadge({ inv }: { inv: InvoiceListItem }) {
  if (inv.at_communicated) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
        Compra Registada
      </span>
    )
  }
  if (inv.efatura_at_status) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        Pendente AT
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">Sem FC</span>
  )
}

const HEADERS: Array<{ key: string; label: string; tip: string; className?: string }> = [
  { key: "supplier",    label: "Fornecedor", tip: "Nome e NIF do fornecedor da fatura" },
  { key: "number",      label: "Nr. Fatura", tip: "Numero de identificacao da fatura emitida pelo fornecedor", className: "hidden md:table-cell" },
  { key: "date",        label: "Data",       tip: "Data de emissao da fatura", className: "hidden lg:table-cell" },
  { key: "erp",        label: "FC ERP",     tip: "Numero do documento no TOCONLINE (Fatura de Compra)", className: "hidden lg:table-cell" },
  { key: "project",    label: "Projeto",    tip: "Obra ou projeto ao qual esta fatura esta associada", className: "hidden md:table-cell" },
  { key: "value",      label: "Valor",      tip: "Valor total da fatura com IVA incluido", className: "text-right" },
  { key: "status",     label: "Estado",     tip: "Estado atual do processamento da fatura" },
  { key: "bank",       label: "Bancario",   tip: "Indica se a fatura foi conciliada com um movimento bancario", className: "hidden xl:table-cell" },
  { key: "at",         label: "AT",         tip: "Indica se a fatura esta registada na e-Fatura da Autoridade Tributaria", className: "hidden xl:table-cell" },
  { key: "source",     label: "Origem",     tip: "Canal por onde a fatura foi recebida - email, WhatsApp ou upload manual", className: "hidden sm:table-cell" },
]

export function InvoiceTable({
  invoices,
  canEdit = false,
}: {
  invoices: InvoiceListItem[]
  canEdit?: boolean
}) {
  const router = useRouter()
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
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  const show = useCallback((e: React.MouseEvent<HTMLTableCellElement>, text: string) => {
    const r = e.currentTarget.getBoundingClientRect()
    setTooltip({ text, x: r.left + r.width / 2, y: r.bottom + 6 })
  }, [])

  const hide = useCallback(() => setTooltip(null), [])

  if (invoices.length === 0) {
    return (
      <div className="border rounded-lg p-12 flex flex-col items-center text-center bg-background">
        <FileText className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="font-semibold mb-1">Sem faturas para mostrar</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Quando enviares faturas via WhatsApp, email ou upload manual, vão
          aparecer aqui. Tenta também ajustar os filtros.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translateX(-50%)",
            zIndex: 9999,
            pointerEvents: "none",
            whiteSpace: "nowrap",
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
      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              {HEADERS.map((h) => (
                <TableHead
                  key={h.key}
                  className={cn("cursor-default select-none", h.className)}
                  onMouseEnter={(e) => show(e, h.tip)}
                  onMouseLeave={hide}
                >
                  {h.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const SourceIcon = SOURCE_ICONS[inv.source] ?? FileText
              return (
                <TableRow key={inv.id} className="cursor-pointer">
                  <TableCell className="p-0">
                    <Link href={`/faturas/${inv.id}`} className="block px-2 py-3 h-full" aria-label="Ver fatura">
                      <SourceIcon className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/faturas/${inv.id}`} className="block">
                      <div className="flex items-center gap-2">
                        {inv.document_kind === "credit_note" && (
                          <Badge
                            variant="outline"
                            className="shrink-0 bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40"
                          >
                            NC
                          </Badge>
                        )}
                        <span className="font-medium truncate">
                          {inv.supplier_name ?? "Fornecedor desconhecido"}
                        </span>
                        {inv.needs_review && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-label="Necessita revisão" />
                        )}
                      </div>
                      {inv.supplier_nif && (
                        <p className="text-xs text-muted-foreground font-mono">{inv.supplier_nif}</p>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-sm">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.invoice_number ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.invoice_date ? formatDate(inv.invoice_date) : "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono text-sm">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.toconline_fc_id ? (
                        <span className="text-foreground">{inv.toconline_fc_id}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: inv.project.color }}
                              />
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
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: p.color }}
                                />
                                {p.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Link href={`/faturas/${inv.id}`} className="block">
                        {inv.project ? (
                          <Badge variant="outline" className="font-normal" style={{ borderColor: inv.project.color, color: inv.project.color }}>
                            {inv.project.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.total !== null ? formatCurrency(inv.total) : "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/faturas/${inv.id}`} className="block">
                      <StatusBadge status={inv.status} />
                    </Link>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      <BankBadge inv={inv} />
                    </Link>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      <ATBadge inv={inv} />
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Link href={`/faturas/${inv.id}`} className="block text-xs text-muted-foreground">
                      {SOURCE_LABELS[inv.source]}
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
