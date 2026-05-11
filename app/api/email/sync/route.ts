import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { syncTenantEmails } from "@/lib/email/sync"
import { log } from "@/lib/utils/audit"

export const runtime = "nodejs"
export const maxDuration = 300 // Fluid compute default — sync pode demorar

/**
 * Sync manual do email IMAP para o tenant do utilizador. Apenas owner/admin
 * podem disparar (são quem configurou as credenciais).
 *
 * Devolve resumo: { emailsFetched, results, errors }.
 */
export async function POST() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const admin = createAdminClient()
  const summary = await syncTenantEmails(admin, ctx.tenantId)

  const invoicesCreated = summary.results.reduce(
    (n, r) => n + r.invoicesCreated,
    0,
  )
  const duplicates = summary.results.reduce(
    (n, r) => n + r.duplicatesSkipped,
    0,
  )

  await log(admin, {
    action: "email.synced",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "tenant_integration",
    metadata: {
      manual: true,
      emails_fetched: summary.emailsFetched,
      invoices_created: invoicesCreated,
      duplicates,
      errors_count: summary.errors.length,
    },
  })

  return Response.json({
    data: {
      emailsFetched: summary.emailsFetched,
      invoicesCreated,
      duplicatesSkipped: duplicates,
      errors: summary.errors,
      results: summary.results,
    },
  })
}
