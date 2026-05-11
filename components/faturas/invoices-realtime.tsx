"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

/**
 * Subscreve a inserts de invoices do tenant atual via Supabase Realtime.
 * Quando aparece uma nova fatura (tipicamente vinda do cron de email),
 * mostra um toast com botão para refresh.
 *
 * RLS já filtra por tenant — não precisamos passar tenantId.
 */
export function InvoicesRealtime({ tenantId }: { tenantId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`invoices:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "invoices",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string
            supplier_name: string | null
            source: string | null
            needs_review: boolean | null
          }
          const sourceLabel =
            row.source === "email"
              ? "Email"
              : row.source === "whatsapp"
                ? "WhatsApp"
                : row.source === "telegram"
                  ? "Telegram"
                  : "Nova"

          toast.success(`${sourceLabel}: nova fatura`, {
            description:
              row.supplier_name ??
              (row.needs_review ? "Necessita revisão" : "Recebida"),
            action: {
              label: "Atualizar",
              onClick: () => router.refresh(),
            },
            duration: 8000,
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, router])

  return null
}
