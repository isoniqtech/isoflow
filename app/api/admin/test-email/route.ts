import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getCurrentSession } from "@/lib/queries/current-session"
import { isSuperAdmin } from "@/lib/supabase/admin"

/**
 * ROTA DE DIAGNOSTICO TEMPORARIA - remover apos confirmar o envio de email.
 * So super-admin. Corre um envio de teste via Resend e devolve o resultado
 * (config presente + resposta do Resend) para diagnostico no browser, ja que
 * o output de console nao aparece nos logs deste projeto.
 * NUNCA devolve o valor da API key - apenas booleans.
 */
export async function GET() {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ADMIN_EMAIL
  const from = process.env.RESEND_FROM ?? "ISOFlow <notificacoes@isoniqtech.com>"

  const config = {
    hasApiKey: Boolean(apiKey),
    apiKeyPrefix: apiKey ? apiKey.slice(0, 5) : null,
    hasAdminEmail: Boolean(to),
    adminEmail: to ?? null,
    from,
    resendFromEnvSet: Boolean(process.env.RESEND_FROM),
  }

  if (!apiKey || !to) {
    return NextResponse.json({
      ok: false,
      reason: "Config em falta no runtime (RESEND_API_KEY ou ADMIN_EMAIL vazios)",
      config,
    })
  }

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "ISOFlow - teste de email de diagnostico",
      text: "Se recebeste este email, o envio via Resend esta a funcionar em producao.",
    })

    return NextResponse.json({
      ok: !error,
      config,
      resend: {
        id: data?.id ?? null,
        error: error ? { name: error.name, message: error.message } : null,
      },
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      config,
      threw: e instanceof Error ? e.message : String(e),
    })
  }
}
