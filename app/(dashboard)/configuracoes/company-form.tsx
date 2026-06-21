"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Upload, X } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { validateNIF } from "@/lib/utils/portugal"
import type { VatRegime } from "@/types"

const VAT_REGIME_OPTIONS: { value: VatRegime; label: string }[] = [
  { value: "normal",    label: "Taxa Normal (23%)" },
  { value: "intermedio", label: "Taxa Intermédia (13%)" },
  { value: "reduzido",  label: "Taxa Reduzida (6%)" },
  { value: "isento",    label: "Isento (0%)" },
]

const formSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(100),
  app_name: z.string().trim().min(1).max(50),
  nif: z
    .string()
    .trim()
    .refine((v) => !v || validateNIF(v), "NIF inválido")
    .or(z.literal("")),
  phone: z.string().trim().max(50),
  address: z.string().trim().max(500),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor hex inválida"),
  vat_regime: z.enum(["isento", "reduzido", "intermedio", "normal"]),
  auto_erp_send: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

export function CompanyForm({
  tenant,
}: {
  tenant: {
    id: string
    name: string
    nif: string | null
    primary_color: string
    app_name: string
    phone: string | null
    address: string | null
    vat_regime: VatRegime
    auto_erp_send: boolean
    logo_url: string | null
  }
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logo_url)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: tenant.name,
      app_name: tenant.app_name,
      nif: tenant.nif ?? "",
      phone: tenant.phone ?? "",
      address: tenant.address ?? "",
      primary_color: tenant.primary_color,
      vat_regime: tenant.vat_regime,
      auto_erp_send: tenant.auto_erp_send,
    },
  })

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const form = new FormData()
    form.append("logo", file)
    const res = await fetch("/api/configuracoes/logo", { method: "POST", body: form })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao carregar logo")
    } else {
      setLogoUrl(json.url)
      toast.success("Logo atualizado")
      router.refresh()
    }
    setLogoUploading(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleLogoRemove() {
    setLogoUploading(true)
    const res = await fetch("/api/configuracoes/logo", { method: "DELETE" })
    if (res.ok) {
      setLogoUrl(null)
      toast.success("Logo removido")
      router.refresh()
    } else {
      toast.error("Erro ao remover logo")
    }
    setLogoUploading(false)
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("tenants")
      .update({
        name: values.name,
        app_name: values.app_name,
        nif: values.nif || null,
        phone: values.phone || null,
        address: values.address || null,
        primary_color: values.primary_color,
        vat_regime: values.vat_regime,
        auto_erp_send: values.auto_erp_send,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenant.id)

    if (error) {
      toast.error("Não foi possível guardar", { description: error.message, duration: 8000 })
      setSubmitting(false)
      return
    }

    toast.success("Configurações guardadas")
    setSubmitting(false)
    router.refresh()
  }

  const appInitial = tenant.app_name.charAt(0).toUpperCase()

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* Logo da empresa */}
        <div className="flex items-center gap-4 pb-2">
          <div className="relative shrink-0">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Logo da empresa"
                width={64}
                height={64}
                className="h-16 w-16 rounded-xl object-contain border bg-muted"
                unoptimized
              />
            ) : (
              <div
                className="h-16 w-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold border"
                style={{ backgroundColor: tenant.primary_color }}
              >
                {appInitial}
              </div>
            )}
            {logoUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Logo da empresa</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP ou SVG. Max 2 MB.</p>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logoUploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {logoUrl ? "Substituir" : "Carregar logo"}
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={logoUploading}
                  onClick={handleLogoRemove}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da empresa</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nif"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NIF</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" maxLength={9} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="app_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da app</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  Aparece na sidebar (default: ISOFlow).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="primary_color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cor primária</FormLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-10 w-14 rounded-md border cursor-pointer shrink-0"
                  />
                  <FormControl>
                    <Input {...field} className="font-mono" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="vat_regime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Regime de IVA</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleciona o regime" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {VAT_REGIME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Usado nos cálculos de projetos e na estimativa de IVA do dashboard.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input type="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Morada</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="auto_erp_send"
          render={({ field }) => (
            <FormItem className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                </FormControl>
                <div>
                  <FormLabel className="font-medium cursor-pointer">
                    Envio automatico ao ERP
                  </FormLabel>
                  <FormDescription className="mt-0.5">
                    Quando chega uma nova fatura em estado &quot;Em Sistema&quot; sem necessitar de revisao, e enviada automaticamente ao ERP.
                  </FormDescription>
                </div>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar alteracoes
          </Button>
        </div>
      </form>
    </Form>
  )
}
