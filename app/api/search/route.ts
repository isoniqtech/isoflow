import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"

const querySchema = z.object({
  q: z.string().trim().min(1).max(100),
})

export type SearchHit = {
  id: string
  type: "fatura" | "projeto" | "ticket"
  title: string
  subtitle: string | null
  href: string
}

export type SearchResponse = {
  faturas: SearchHit[]
  projetos: SearchHit[]
  tickets: SearchHit[]
}

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({ q: url.searchParams.get("q") ?? "" })
  if (!parsed.success) {
    return Response.json({ faturas: [], projetos: [], tickets: [] })
  }
  const q = parsed.data.q
  const like = `%${q}%`

  const supabase = createClient()

  const [{ data: invoices }, { data: projects }, { data: tickets }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, supplier_name, invoice_number, total, currency, status")
        .eq("tenant_id", ctx.tenantId)
        .or(
          `supplier_name.ilike.${like},invoice_number.ilike.${like},supplier_nif.ilike.${like}`,
        )
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("projects")
        .select("id, name, code, type")
        .eq("tenant_id", ctx.tenantId)
        .or(`name.ilike.${like},code.ilike.${like},client_name.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("support_tickets")
        .select("id, title, status, priority")
        .eq("tenant_id", ctx.tenantId)
        .ilike("title", like)
        .order("updated_at", { ascending: false })
        .limit(8),
    ])

  const faturas: SearchHit[] = (invoices ?? []).map((i) => ({
    id: i.id,
    type: "fatura",
    title: i.supplier_name ?? "Fornecedor desconhecido",
    subtitle: [
      i.invoice_number,
      i.total !== null ? formatCurrencyServer(Number(i.total)) : null,
      labelStatus(i.status),
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/faturas/${i.id}`,
  }))

  const projetos: SearchHit[] = (projects ?? []).map((p) => ({
    id: p.id,
    type: "projeto",
    title: p.name,
    subtitle: [p.code, p.type ?? null].filter(Boolean).join(" · "),
    href: `/projetos/${p.id}`,
  }))

  const ticketHits: SearchHit[] = (tickets ?? []).map((t) => ({
    id: t.id,
    type: "ticket",
    title: t.title,
    subtitle: [t.priority, t.status].filter(Boolean).join(" · "),
    href: `/suporte/${t.id}`,
  }))

  const response: SearchResponse = {
    faturas,
    projetos,
    tickets: ticketHits,
  }
  return Response.json(response)
}

function formatCurrencyServer(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function labelStatus(status: string | null): string | null {
  if (!status) return null
  const map: Record<string, string> = {
    pending: "Pendente",
    processing: "A processar",
    matched: "Conciliada",
    paid: "Paga",
    rejected: "Rejeitada",
    duplicate: "Duplicada",
  }
  return map[status] ?? status
}
