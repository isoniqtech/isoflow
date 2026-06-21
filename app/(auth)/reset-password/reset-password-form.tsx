"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { createClient } from "@/lib/supabase/client"

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords não coincidem",
    path: ["confirm_password"],
  })

type Values = z.infer<typeof schema>

export function ResetPasswordForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const hash = window.location.hash
    if (hash && hash.includes("access_token")) {
      const params = new URLSearchParams(hash.substring(1))
      const access_token = params.get("access_token") ?? ""
      const refresh_token = params.get("refresh_token") ?? ""
      supabase.auth.setSession({ access_token, refresh_token }).then(() => setReady(true))
    } else {
      supabase.auth.getSession().then(() => setReady(true))
    }
  }, [])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm_password: "" },
  })

  async function onSubmit(values: Values) {
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    })

    if (error) {
      toast.error("Não foi possível atualizar a password", {
        description: error.message,
      })
      setSubmitting(false)
      return
    }

    toast.success("Password atualizada")
    router.push("/")
    router.refresh()
  }

  if (!ready) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nova password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar password
        </Button>
      </form>
    </Form>
  )
}
