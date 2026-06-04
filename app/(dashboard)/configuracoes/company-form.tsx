"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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
  }
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

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
      console.error("Company update failed:", error)
      toast.error("Não foi possível guardar", {
        description: error.message,
        duration: 8000,
      })
      setSubmitting(false)
      return
    }

    toast.success("Configurações guardadas")
    setSubmitting(false)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    Envio automático ao ERP
                  </FormLabel>
                  <FormDescription className="mt-0.5">
                    Quando chega uma nova fatura em estado &quot;Em Sistema&quot; sem necessitar de revisão, é enviada automaticamente ao ERP.
                  </FormDescription>
                </div>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar alterações
          </Button>
        </div>
      </form>
    </Form>
  )
}
