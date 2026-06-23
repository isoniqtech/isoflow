import { createAdminClient } from "@/lib/supabase/admin"
import { syncTenantEmails } from "@/lib/email/sync"
import type { DateRange } from "@/lib/email/gmail-imap"
import { log } from "@/lib/utils/audit"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Cron job — executado 3x/dia (horarios PT = UTC+1):
 *   9h PT  (8h UTC)  → emails das 20h PT do dia anterior ate as 9h PT
 *   14h PT (13h UTC) → emails das 9h PT ate as 14h PT
 *   20h PT (19h UTC) → emails das 14h PT ate as 20h PT
 * Margem de 5 minutos em cada extremo para evitar gaps entre janelas.
 */
function getCronDateRange(): DateRange {
  const now = new Date()
  const hour = now.getUTCHours()
  const MARGIN = 5 * 60 * 1000 // 5 minutos em ms
  const until = new Date(now.getTime() + MARGIN)

  let since: Date
  if (hour >= 8 && hour < 13) {
    // 9h PT (8h UTC) → desde as 20h PT de ontem (19h UTC)
    const prev = new Date(now)
    prev.setUTCDate(prev.getUTCDate() - 1)
    prev.setUTCHours(19, 0, 0, 0)
    since = new Date(prev.getTime() - MARGIN)
  } else if (hour >= 13 && hour < 19) {
    // 14h PT (13h UTC) → desde as 9h PT de hoje (8h UTC)
    const start = new Date(now)
    start.setUTCHours(8, 0, 0, 0)
    since = new Date(start.getTime() - MARGIN)
  } else {
    // 20h PT (19h UTC) → desde as 14h PT de hoje (13h UTC)
    const start = new Date(now)
    start.setUTCHours(13, 0, 0, 0)
    since = new Date(start.getTime() - MARGIN)
  }

  return { since, until }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const dateRange = getCronDateRange()

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
      const summary = await syncTenantEmails(admin, tenantId, dateRange)
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
            since: dateRange.since.toISOString(),
            until: dateRange.until.toISOString(),
            emails_fetched: summary.emailsFetched,
            invoices_created: invoicesCreated,
            errors_count: summary.errors.length,
          },
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`cron sync tenant=${tenantId} failed:`, msg)
      out.push({ tenantId, emailsFetched: 0, invoicesCreated: 0, errors: 1 })
    }
  }

  return Response.json({
    data: {
      since: dateRange.since.toISOString(),
      until: dateRange.until.toISOString(),
      tenants_processed: out.length,
      summary: out,
    },
  })
}
