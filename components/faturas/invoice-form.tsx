"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Upload, FileText, X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { parseDecimal, validateNIF, VAT_RATES } from "@/lib/utils/portugal"
import type { ProjectOption } from "@/lib/queries/invoices"

const formSchema = z.object({
  supplier_name: z.string().trim().min(1, "Obrigatório").max(200),
  supplier_nif: z
    .string()
    .trim()
    .refine((v) => !v || validateNIF(v), "NIF inválido")
    .or(z.literal("")),
  invoice_number: z.string().trim().max(100),
  invoice_date: z.string().trim(),
  due_date: z.string().trim(),
  subtotal: z
    .string()
    .trim()
    .refine((v) => !v || !isNaN(parseDecimal(v)), "Valor inválido"),
  vat_rate: z.string().trim(),
  total: z
    .string()
    .trim()
    .refine((v) => {
      const n = parseDecimal(v)
      return !isNaN(n) && n > 0
    }, "Total obrigatório"),
  category: z.string().trim(),
  description: z.string().trim().max(500),
  project_id: z.string().trim(),
  notes: z.string().trim().max(2000),
})

type FormValues = z.infer<typeof formSchema>

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "transporte", label: "Transporte" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "servicos", label: "Serviços" },
  { value: "material", label: "Material" },
  { value: "combustivel", label: "Combustível" },
  { value: "comunicacoes", label: "Comunicações" },
  { value: "alojamento", label: "Alojamento" },
  { value: "formacao", label: "Formação" },
  { value: "outro", label: "Outro" },
]

const VAT_OPTIONS = [
  { value: "0", label: "0% (Isento)" },
  { value: "6", label: "6% (Reduzido)" },
  { value: "13", label: "13% (Intermédio)" },
  { value: "23", label: "23% (Normal)" },
]

export function InvoiceForm({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[]
  defaultProjectId?: string
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{ name: string; path: string; type: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_name: "",
      supplier_nif: "",
      invoice_number: "",
      invoice_date: "",
      due_date: "",
      subtotal: "",
      vat_rate: "23",
      total: "",
      category: "",
      description: "",
      project_id: defaultProjectId ?? "",
      notes: "",
    },
  })

  const subtotalValue = form.watch("subtotal")
  const vatRateValue = form.watch("vat_rate")
  const totalValue = form.watch("total")

  useEffect(() => {
    const subtotal = parseDecimal(subtotalValue ?? "")
    const vatRate = parseDecimal(vatRateValue ?? "")
    const total = parseDecimal(totalValue ?? "")
    if (
      !isNaN(subtotal) &&
      subtotal > 0 &&
      !isNaN(vatRate) &&
      isNaN(total)
    ) {
      const computed = subtotal * (1 + vatRate / 100)
      form.setValue("total", computed.toFixed(2), { shouldDirty: true })
    }
  }, [subtotalValue, vatRateValue, totalValue, form])

  async function handleFile(file: File) {
    if (!file) return
    setExtracting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/faturas/process", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro no upload"); return }

      setUploadedFile({ name: json.file_name, path: json.file_path, type: json.file_type })

      if (json.ai_error) {
        toast.warning("Ficheiro guardado mas extração IA falhou. Preenche manualmente.")
      }

      if (json.extraction) {
        const e = json.extraction
        if (e.supplier_name) form.setValue("supplier_name", e.supplier_name)
        if (e.supplier_nif)  form.setValue("supplier_nif", e.supplier_nif)
        if (e.invoice_number) form.setValue("invoice_number", e.invoice_number)
        if (e.invoice_date)  form.setValue("invoice_date", e.invoice_date)
        if (e.due_date)      form.setValue("due_date", e.due_date)
        if (e.subtotal != null) form.setValue("subtotal", String(e.subtotal))
        if (e.vat_rate != null) form.setValue("vat_rate", String(e.vat_rate))
        if (e.total != null) form.setValue("total", String(e.total))
        if (e.category)      form.setValue("category", e.category)
        if (e.description)   form.setValue("description", e.description)
        if (e.notes)         form.setValue("notes", e.notes)
        toast.success("Dados extraídos com IA. Revê e confirma.")
      }
    } catch { toast.error("Erro de ligação ao servidor") }
    finally { setExtracting(false) }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)

    const subtotalParsed = values.subtotal ? parseDecimal(values.subtotal) : NaN
    const subtotal = !isNaN(subtotalParsed) ? subtotalParsed : null
    const vatRateParsed = values.vat_rate ? parseDecimal(values.vat_rate) : NaN
    const vatRate = !isNaN(vatRateParsed) ? vatRateParsed : null
    const total = parseDecimal(values.total)
    const vatAmount =
      subtotal !== null && vatRate !== null
        ? Number((subtotal * (vatRate / 100)).toFixed(2))
        : null

    const payload = {
      type: "incoming",
      project_id: values.project_id || null,
      supplier_name: values.supplier_name,
      supplier_nif: values.supplier_nif || null,
      invoice_number: values.invoice_number || null,
      invoice_date: values.invoice_date || null,
      due_date: values.due_date || null,
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total,
      currency: "EUR",
      category: values.category || null,
      description: values.description || null,
      notes: values.notes || null,
      needs_review: false,
      ...(uploadedFile ? {
        file_path: uploadedFile.path,
        file_name: uploadedFile.name,
        file_type: uploadedFile.type,
      } : {}),
    }

    const res = await fetch("/api/faturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error("Invoice create failed:", res.status, errBody, payload)
      let description = errBody.error ?? `HTTP ${res.status}`
      if (errBody.details?.fieldErrors) {
        const fieldMessages = Object.entries(errBody.details.fieldErrors)
          .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
          .join(" · ")
        if (fieldMessages) description = fieldMessages
      }
      toast.error("Falha ao criar fatura", {
        description,
        duration: 12000,
      })
      setSubmitting(false)
      return
    }

    const { data } = await res.json()
    toast.success("Fatura criada")
    router.push(`/faturas/${data.id}`)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Zona de upload ──────────────────────────────── */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {!uploadedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
              className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors
                ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"}`}
            >
              {extracting ? (
                <>
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-medium">A extrair dados com IA...</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Arrasta ou clica para carregar fatura</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG ou WEBP — máx 20MB</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Dados extraídos com IA
                </p>
              </div>
              <button type="button" onClick={() => setUploadedFile(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Fornecedor
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="supplier_name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome do fornecedor *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier_nif"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIF</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="9 dígitos"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Detalhes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="invoice_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº da fatura</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoice_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data emissão</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Valores
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="subtotal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subtotal (sem IVA)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vat_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IVA</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VAT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="total"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total *</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormDescription>
                    Calculado se preencheres subtotal + IVA.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Classificação
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projeto</FormLabel>
                  <Select
                    value={field.value || "__none"}
                    onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem projeto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none">Sem projeto</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select
                    value={field.value || "__none"}
                    onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none">Sem categoria</SelectItem>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: Material de construção, abril 2026"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas internas</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar fatura
          </Button>
        </div>
      </form>
    </Form>
  )
}

export const VAT_RATES_PT = VAT_RATES
