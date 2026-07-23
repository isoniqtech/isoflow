"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Download,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/faturas/status-badge"
import { PdfViewer } from "@/components/faturas/pdf-viewer"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { InvoiceDetail as InvoiceDetailType } from "@/lib/queries/invoice-detail"

type ProjectOption = { id: string; name: string; color: string }

// Form uses strings for number inputs — converted to numbers on submit
const editSchema = z.object({
  supplier_name: z.string().max(200),
  supplier_nif: z.string().regex(/^\d{9}$/, "NIF deve ter 9 dígitos").or(z.literal("")),
  invoice_number: z.string().max(100),
  invoice_date: z.string(),
  due_date: z.string(),
  subtotal: z.string(),
  vat_rate: z.string(),
  vat_amount: z.string(),
  total: z.string(),
  description: z.string().max(500),
  category: z
    .enum([
      "transporte",
      "alimentacao",
      "tecnologia",
      "servicos",
      "material",
      "combustivel",
      "comunicacoes",
      "alojamento",
      "formacao",
      "outro",
    ])
    .or(z.literal(""))
    .nullable(),
  notes: z.string().max(2000),
  project_id: z.string().uuid().nullable().or(z.literal("")).nullable(),
  document_kind: z.enum(["invoice", "credit_note"]),
})

type EditForm = z.infer<typeof editSchema>

const CATEGORY_LABELS: Record<string, string> = {
  transporte: "Transporte",
  alimentacao: "Alimentação",
  tecnologia: "Tecnologia",
  servicos: "Serviços",
  material: "Material",
  combustivel: "Combustível",
  comunicacoes: "Comunicações",
  alojamento: "Alojamento",
  formacao: "Formação",
  outro: "Outro",
}

function parseNum(s: string): number | null {
  if (s === "" || s === null || s === undefined) return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export function InvoiceDetail({
  invoice,
  canEdit,
}: {
  invoice: InvoiceDetailType
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<string | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  const aiFailedNoData =
    invoice.file_path &&
    (invoice.needs_review ||
      (invoice.supplier_name === null &&
        (invoice.ai_confidence === null || invoice.ai_confidence === 0)))

  async function handleReprocess() {
    setReprocessing(true)
    try {
      const res = await fetch(`/api/faturas/${invoice.id}/reprocess`, { method: "POST" })
      const body = await res.json()
      if (!res.ok) {
        toast.error("Reprocessamento falhou", { description: body.error ?? `HTTP ${res.status}` })
        return
      }
      toast.success("Fatura reprocessada com sucesso")
      router.refresh()
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setReprocessing(false)
    }
  }

  const { control, handleSubmit, reset, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: toFormValues(invoice),
  })

  function startEditing() {
    if (projects.length === 0 && !projectsLoading) {
      setProjectsLoading(true)
      fetch("/api/projetos")
        .then((r) => r.json())
        .then((body) => {
          const list = (body.data ?? []) as Array<{ id: string; name: string; color: string }>
          setProjects(list.map((p) => ({ id: p.id, name: p.name, color: p.color ?? "#2563EB" })))
        })
        .catch(() => {})
        .finally(() => setProjectsLoading(false))
    }
    setEditing(true)
  }

  useEffect(() => {
    if (!invoice.file_path) return
    setFileLoading(true)
    fetch(`/api/faturas/${invoice.id}/file-url`)
      .then((r) => r.json())
      .then((body) => {
        if (body.url) {
          setFileUrl(body.url)
          setFileType(body.file_type ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setFileLoading(false))
  }, [invoice.id, invoice.file_path])

  async function onSubmit(values: EditForm) {
    setSaving(true)
    try {
      const payload = {
        supplier_name: values.supplier_name || null,
        supplier_nif: values.supplier_nif || null,
        invoice_number: values.invoice_number || null,
        invoice_date: values.invoice_date || null,
        due_date: values.due_date || null,
        subtotal: parseNum(values.subtotal),
        vat_rate: parseNum(values.vat_rate),
        vat_amount: parseNum(values.vat_amount),
        total: parseNum(values.total),
        description: values.description || null,
        category: values.category || null,
        notes: values.notes || null,
        project_id: values.project_id || null,
        document_kind: values.document_kind,
      }

      const res = await fetch(`/api/faturas/${invoice.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error("Erro ao guardar", {
          description: body.error ?? `HTTP ${res.status}`,
        })
        return
      }
      toast.success("Fatura actualizada")
      setEditing(false)
      router.refresh()
    } catch (e) {
      toast.error("Erro de rede", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    reset(toFormValues(invoice))
    setEditing(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Painel esquerdo — viewer */}
      <div className="space-y-3">
        <div
          className="rounded-lg border bg-muted/30 overflow-hidden flex items-center justify-center"
          style={{ minHeight: 480 }}
        >
          {fileLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          {!fileLoading && fileUrl && fileType === "pdf" && <PdfViewer url={fileUrl} />}
          {!fileLoading && fileUrl && fileType !== "pdf" && (
            <img src={fileUrl} alt="Fatura" className="w-full object-contain max-h-[600px]" />
          )}
          {!fileLoading && !fileUrl && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground py-16">
              <FileText className="h-12 w-12" />
              <p className="text-sm">Sem ficheiro anexo</p>
            </div>
          )}
        </div>
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            Descarregar original
          </a>
        )}
      </div>

      {/* Painel direito — dados + edição */}
      <div className="space-y-4">
        {/* Cabeçalho do painel */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Dados da fatura
          </h2>
          {canEdit && !editing && (
            <div className="flex gap-2">
              {aiFailedNoData && (
                <Button variant="outline" size="sm" onClick={handleReprocess} disabled={reprocessing}>
                  {reprocessing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Reprocessar com AI
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Editar
              </Button>
            </div>
          )}
          {editing && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="h-3.5 w-3.5 mr-1.5" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSubmit(onSubmit)} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Guardar
              </Button>
            </div>
          )}
        </div>

        {/* Secção de estados */}
        <div className="flex flex-wrap gap-2">
          {invoice.document_kind === "credit_note" ? (
            <Badge
              variant="outline"
              className="bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40"
            >
              Nota de crédito
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Fatura
            </Badge>
          )}
          <StatusBadge status={invoice.status} />
          {invoice.erp_synced ? (
            <Badge
              variant="outline"
              className="bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40"
            >
              ERP Sincronizado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              ERP Pendente
            </Badge>
          )}
          {invoice.at_communicated ? (
            <Badge
              variant="outline"
              className="bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40"
            >
              Na e-Fatura
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Não comunicado AT
            </Badge>
          )}
        </div>

        {!editing && <CreditNoteSection invoice={invoice} canEdit={canEdit} />}

        {editing ? (
          <InvoiceEditForm control={control} errors={errors} projects={projects} projectsLoading={projectsLoading} />
        ) : (
          <InvoiceViewMode invoice={invoice} />
        )}
      </div>
    </div>
  )
}

type Candidate = { id: string; invoice_number: string | null; supplier_name: string | null }

function CreditNoteSection({
  invoice,
  canEdit,
}: {
  invoice: InvoiceDetailType
  canEdit: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  const isCreditNote = invoice.document_kind === "credit_note"
  const jaEnviada = invoice.erp_synced || invoice.status === "enviada_erp"

  async function patch(payload: Record<string, unknown>, successMsg: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/faturas/${invoice.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error("Não foi possível guardar", { description: body.error ?? `HTTP ${res.status}` })
        return
      }
      toast.success(successMsg)
      setPicking(false)
      router.refresh()
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function sendToErp() {
    setBusy(true)
    try {
      const res = await fetch("/api/faturas/create-ncf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoice_ids: [invoice.id] }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error("Falha ao enviar ao ERP", {
          description: body.details ?? body.error ?? `HTTP ${res.status}`,
          duration: 10000,
        })
        return
      }
      toast.success(
        body.skipped ? "Nota de crédito já estava no ERP" : "Nota de crédito enviada ao ERP",
      )
      router.refresh()
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  function openPicker() {
    setPicking(true)
    if (candidates.length === 0) {
      setLoadingCandidates(true)
      fetch("/api/faturas")
        .then((r) => r.json())
        .then((body) => {
          const list = (body.data ?? []) as Array<Record<string, unknown>>
          setCandidates(
            list
              .filter(
                (i) =>
                  (i.document_kind ?? "invoice") === "invoice" && i.id !== invoice.id,
              )
              .map((i) => ({
                id: String(i.id),
                invoice_number: (i.invoice_number as string | null) ?? null,
                supplier_name: (i.supplier_name as string | null) ?? null,
              })),
          )
        })
        .catch(() => {})
        .finally(() => setLoadingCandidates(false))
    }
  }

  // So mostrar a secção quando ha algo a dizer: e' nota de credito, ou e' uma
  // fatura com notas de credito associadas.
  if (!isCreditNote && invoice.credit_notes.length === 0) return null

  return (
    <Card className={isCreditNote ? "border-amber-200 dark:border-amber-900/40" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {isCreditNote ? "Nota de crédito" : "Notas de crédito associadas"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isCreditNote ? (
          <>
            {invoice.related_invoice ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Fatura original</span>
                <a
                  href={`/faturas/${invoice.related_invoice.id}`}
                  className="font-medium text-primary hover:underline text-right"
                >
                  {invoice.related_invoice.invoice_number ?? "ver fatura"}
                </a>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-amber-300 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2">
                <p className="font-medium text-amber-900 dark:text-amber-200">Por associar</p>
                {invoice.referenced_document_number && (
                  <p className="text-xs text-muted-foreground">
                    Refere a fatura {invoice.referenced_document_number}
                  </p>
                )}
              </div>
            )}

            {canEdit && (
              <div className="flex flex-wrap gap-2 pt-1">
                {invoice.related_invoice ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => patch({ related_invoice_id: null }, "Associação removida")}
                  >
                    Desassociar
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled={busy} onClick={openPicker}>
                    Associar a fatura
                  </Button>
                )}
                {!jaEnviada && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      patch({ document_kind: "invoice" }, "Reclassificado como fatura")
                    }
                  >
                    Reclassificar como fatura
                  </Button>
                )}
                {!jaEnviada && (
                  <Button size="sm" disabled={busy} onClick={sendToErp}>
                    {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Enviar ao ERP
                  </Button>
                )}
              </div>
            )}

            {picking && (
              <div className="flex flex-col gap-2 pt-1">
                <Select
                  onValueChange={(v) =>
                    patch({ related_invoice_id: v }, "Nota de crédito associada")
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingCandidates ? "A carregar…" : "Escolher fatura"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {(c.invoice_number ?? "sem nº") + " · " + (c.supplier_name ?? "—")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        ) : (
          <>
            <ul className="space-y-1">
              {invoice.credit_notes.map((cn) => (
                <li key={cn.id} className="flex items-center justify-between gap-2">
                  <a
                    href={`/faturas/${cn.id}`}
                    className="text-primary hover:underline truncate"
                  >
                    {cn.invoice_number ?? "Nota de crédito"}
                  </a>
                  <span className="tabular-nums text-muted-foreground">
                    {cn.total !== null ? "-" + formatCurrency(cn.total) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function toFormValues(invoice: InvoiceDetailType): EditForm {
  return {
    supplier_name: invoice.supplier_name ?? "",
    supplier_nif: invoice.supplier_nif ?? "",
    invoice_number: invoice.invoice_number ?? "",
    invoice_date: invoice.invoice_date ?? "",
    due_date: invoice.due_date ?? "",
    subtotal: invoice.subtotal !== null ? String(invoice.subtotal) : "",
    vat_rate: invoice.vat_rate !== null ? String(invoice.vat_rate) : "",
    vat_amount: invoice.vat_amount !== null ? String(invoice.vat_amount) : "",
    total: invoice.total !== null ? String(invoice.total) : "",
    description: invoice.description ?? "",
    category: (invoice.category as EditForm["category"]) ?? null,
    notes: invoice.notes ?? "",
    project_id: invoice.project?.id ?? null,
    document_kind: invoice.document_kind,
  }
}

function InvoiceViewMode({ invoice }: { invoice: InvoiceDetailType }) {
  return (
    <div className="space-y-4">
      {invoice.project && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border text-sm">
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: invoice.project.color }}
          />
          <span className="font-medium truncate">{invoice.project.name}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Fornecedor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{invoice.supplier_name ?? "—"}</p>
          {invoice.supplier_nif && (
            <p className="text-muted-foreground font-mono text-xs">NIF: {invoice.supplier_nif}</p>
          )}
          {invoice.supplier_email && (
            <p className="text-muted-foreground text-xs">{invoice.supplier_email}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Valores</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Nº fatura</dt>
            <dd className="text-right font-mono text-xs">{invoice.invoice_number ?? "—"}</dd>
            <dt className="text-muted-foreground">Data</dt>
            <dd className="text-right">{invoice.invoice_date ? formatDate(invoice.invoice_date) : "—"}</dd>
            <dt className="text-muted-foreground">Vencimento</dt>
            <dd className="text-right">{invoice.due_date ? formatDate(invoice.due_date) : "—"}</dd>
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-right tabular-nums">
              {invoice.subtotal !== null ? formatCurrency(invoice.subtotal) : "—"}
            </dd>
            <dt className="text-muted-foreground">
              IVA{invoice.vat_rate !== null ? ` (${invoice.vat_rate}%)` : ""}
            </dt>
            <dd className="text-right tabular-nums">
              {invoice.vat_amount !== null ? formatCurrency(invoice.vat_amount) : "—"}
            </dd>
            <dt className="font-semibold border-t pt-2">Total</dt>
            <dd className="text-right tabular-nums font-semibold border-t pt-2">
              {invoice.total !== null ? formatCurrency(invoice.total) : "—"}
            </dd>
          </dl>
        </CardContent>
      </Card>

      {(invoice.category || invoice.description || invoice.notes) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invoice.category && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoria</span>
                <Badge variant="secondary">
                  {CATEGORY_LABELS[invoice.category] ?? invoice.category}
                </Badge>
              </div>
            )}
            {invoice.description && (
              <p className="text-muted-foreground whitespace-pre-line">{invoice.description}</p>
            )}
            {invoice.notes && (
              <p className="text-xs text-muted-foreground whitespace-pre-line border-t pt-2">
                {invoice.notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InvoiceEditForm({
  control,
  errors,
  projects,
  projectsLoading,
}: {
  control: ReturnType<typeof useForm<EditForm>>["control"]
  errors: ReturnType<typeof useForm<EditForm>>["formState"]["errors"]
  projects: ProjectOption[]
  projectsLoading: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="document_kind">Tipo de documento</Label>
        <Controller
          control={control}
          name="document_kind"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="document_kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">Fatura</SelectItem>
                <SelectItem value="credit_note">Nota de crédito</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="project_id">Projeto</Label>
        <Controller
          control={control}
          name="project_id"
          render={({ field }) => (
            <Select
              value={field.value ?? "none"}
              onValueChange={(v) => field.onChange(v === "none" ? null : v)}
              disabled={projectsLoading}
            >
              <SelectTrigger id="project_id">
                <SelectValue placeholder={projectsLoading ? "A carregar…" : "Sem projeto"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Sem projeto</span>
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="supplier_name">Fornecedor</Label>
          <Controller
            control={control}
            name="supplier_name"
            render={({ field }) => <Input id="supplier_name" {...field} />}
          />
          {errors.supplier_name && (
            <p className="text-xs text-destructive">{errors.supplier_name.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="supplier_nif">NIF</Label>
          <Controller
            control={control}
            name="supplier_nif"
            render={({ field }) => (
              <Input id="supplier_nif" {...field} maxLength={9} inputMode="numeric" />
            )}
          />
          {errors.supplier_nif && (
            <p className="text-xs text-destructive">{errors.supplier_nif.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="invoice_number">Nº fatura</Label>
          <Controller
            control={control}
            name="invoice_number"
            render={({ field }) => <Input id="invoice_number" {...field} />}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="category">Categoria</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(v) => field.onChange(v || null)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="invoice_date">Data fatura</Label>
          <Controller
            control={control}
            name="invoice_date"
            render={({ field }) => <Input id="invoice_date" type="date" {...field} />}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="due_date">Vencimento</Label>
          <Controller
            control={control}
            name="due_date"
            render={({ field }) => <Input id="due_date" type="date" {...field} />}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="subtotal">Subtotal (€)</Label>
          <Controller
            control={control}
            name="subtotal"
            render={({ field }) => (
              <Input id="subtotal" type="number" step="0.01" min="0" {...field} />
            )}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="vat_rate">Taxa IVA (%)</Label>
          <Controller
            control={control}
            name="vat_rate"
            render={({ field }) => (
              <Input id="vat_rate" type="number" step="1" min="0" max="100" {...field} />
            )}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="vat_amount">Valor IVA (€)</Label>
          <Controller
            control={control}
            name="vat_amount"
            render={({ field }) => (
              <Input id="vat_amount" type="number" step="0.01" min="0" {...field} />
            )}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="total">Total (€)</Label>
          <Controller
            control={control}
            name="total"
            render={({ field }) => (
              <Input id="total" type="number" step="0.01" min="0" {...field} />
            )}
          />
          {errors.total && (
            <p className="text-xs text-destructive">{errors.total.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Descrição</Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <textarea
              id="description"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              rows={2}
              {...field}
            />
          )}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notas internas</Label>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <textarea
              id="notes"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              rows={2}
              {...field}
            />
          )}
        />
      </div>
    </div>
  )
}
