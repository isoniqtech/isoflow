import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
}

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Faturação",
  technical: "Técnico",
  integration: "Integração",
  invoice: "Faturas",
  banking: "Banco",
  other: "Outro",
}

type TicketForEmail = {
  id: string
  tenant_id: string
  created_by: string
  title: string
  description: string
  priority: string
  category: string | null
}

/**
 * Avisa o super-admin por email que foi aberto um novo ticket de suporte.
 * No-op silencioso se RESEND_API_KEY ou ADMIN_EMAIL não estiverem configurados.
 * Nunca deve lançar - a criação do ticket não pode falhar por causa do email.
 */
export async function notifyTicketCreated(ticket: TicketForEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ADMIN_EMAIL
  const from = process.env.RESEND_FROM ?? "ISOFlow <notificacoes@isoniqtech.com>"

  if (!apiKey || !to) {
    // Configuração de email ausente - segue sem enviar.
    return
  }

  try {
    const supabase = createAdminClient()
    const [{ data: tenant }, { data: author }] = await Promise.all([
      supabase.from("tenants").select("name").eq("id", ticket.tenant_id).maybeSingle(),
      supabase.from("users").select("name, email").eq("id", ticket.created_by).maybeSingle(),
    ])

    const priority = PRIORITY_LABELS[ticket.priority] ?? ticket.priority
    const category = ticket.category ? (CATEGORY_LABELS[ticket.category] ?? ticket.category) : "-"
    const tenantName = tenant?.name ?? "Empresa desconhecida"
    const authorName = author?.name ?? "Utilizador desconhecido"
    const authorEmail = author?.email ?? ""
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
    const link = `${appUrl}/admin/tickets/${ticket.id}`

    const subject = `Novo ticket de suporte: ${ticket.title}`

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; color: #141F0A; max-width: 560px;">
        <h2 style="margin: 0 0 4px; font-size: 18px;">Novo ticket de suporte</h2>
        <p style="margin: 0 0 16px; color: #4b5563; font-size: 14px;">
          ${tenantName} abriu um pedido de suporte.
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #6b7280; width: 120px;">Título</td><td style="padding: 6px 0; font-weight: 600;">${ticket.title}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Prioridade</td><td style="padding: 6px 0;">${priority}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Categoria</td><td style="padding: 6px 0;">${category}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Empresa</td><td style="padding: 6px 0;">${tenantName}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Autor</td><td style="padding: 6px 0;">${authorName}${authorEmail ? ` (${authorEmail})` : ""}</td></tr>
        </table>
        <div style="margin: 16px 0; padding: 12px 14px; background: #F5F8EF; border-radius: 8px; font-size: 14px; white-space: pre-wrap;">${ticket.description}</div>
        ${
          appUrl
            ? `<a href="${link}" style="display: inline-block; background: #344E0D; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;">Ver ticket</a>`
            : ""
        }
      </div>
    `

    const text = [
      `Novo ticket de suporte`,
      ``,
      `Título: ${ticket.title}`,
      `Prioridade: ${priority}`,
      `Categoria: ${category}`,
      `Empresa: ${tenantName}`,
      `Autor: ${authorName}${authorEmail ? ` (${authorEmail})` : ""}`,
      ``,
      ticket.description,
      ``,
      appUrl ? `Ver ticket: ${link}` : "",
    ].join("\n")

    const resend = new Resend(apiKey)
    await resend.emails.send({ from, to, subject, html, text })
  } catch (error) {
    // Falha de email nunca deve propagar para o fluxo de criação do ticket.
    console.error("notifyTicketCreated failed:", error)
  }
}
