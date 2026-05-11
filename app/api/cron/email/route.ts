import { createAdminClient } from "@/lib/supabase/admin"
import { syncTenantEmails } from "@/lib/email/sync"
import { log } from "@/lib/utils/audit"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Cron job — executado pelo Vercel a cada 5 minutos (config em vercel.json).
 *
 * Autenticação: header `Authorization: Bearer ${CRON_SECRET}` (definido em
 * env). O Vercel Cron envia esse header automaticamente quando configurado.
 *
 * Itera por todos os tenants com integração de email ativa e dispara um
 * sync para cada. Falhas isoladas não bloqueiam os restantes.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: integrations, error } = await admin
    .from("tenant_integrations")
    .select("tenant_id")
    .eq("type", "email")
    .eq("provider", "imap")
    .eq("is_active", true)

  if (error) {
    console.error("cron/email list integrations failed:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const tenantIds = Array.from(
    new Set((integrations ?? []).map((i) => i.tenant_id)),
  )

  const out: Array<{
    tenantId: string
    emailsFetched: number
    invoicesCreated: number
    errors: number
  }> = []

  for (const tenantId of tenantIds) {
    try {
      const summary = await syncTenantEmails(admin, tenantId)
      const invoicesCreated = summary.results.reduce(
        (n, r) => n + r.invoicesCreated,
        0,
      )
      out.push({
        tenantId,
        emailsFetched: summary.emailsFetched,
        invoicesCreated,
        errors: summary.errors.length,
      })
      if (summary.emailsFetched > 0 || summary.errors.length > 0) {
        await log(admin, {
          action: "email.synced",
          tenantId,
          userId: null,
          resourceType: "tenant_integration",
          metadata: {
            manual: false,
            emails_fetched: summary.emailsFetched,
            invoices_created: invoicesCreated,
            errors_count: summary.errors.length,
          },
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`cron sync tenant=${tenantId} failed:`, msg)
      out.push({
        tenantId,
        emailsFetched: 0,
        invoicesCreated: 0,
        errors: 1,
      })
    }
  }

  return Response.json({
    data: {
      tenants_processed: out.length,
      summary: out,
    },
  })
}
