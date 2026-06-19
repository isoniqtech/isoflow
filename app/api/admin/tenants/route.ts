import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin } from "@/lib/api/admin-auth"
import { jsonError } from "@/lib/api/auth"

export async function GET() {
  const adminId = await requireSuperAdmin()
  if (!adminId) return jsonError("Forbidden", 403)

  const admin = createAdminClient()

  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, name, nif, email, plan, status, credits_balance, created_at, trial_ends_at")
    .order("created_at", { ascending: false })

  if (error) return jsonError("Database error", 500, error.message)

  const tenantIds = (tenants ?? []).map((t) => t.id)

  const [usersRes, invoicesRes] = await Promise.all([
    admin
      .from("users")
      .select("tenant_id")
      .in("tenant_id", tenantIds),
    admin
      .from("invoices")
      .select("tenant_id")
      .in("tenant_id", tenantIds),
  ])

  const userCounts: Record<string, number> = {}
  const invoiceCounts: Record<string, number> = {}

  for (const u of usersRes.data ?? []) {
    userCounts[u.tenant_id] = (userCounts[u.tenant_id] ?? 0) + 1
  }
  for (const i of invoicesRes.data ?? []) {
    invoiceCounts[i.tenant_id] = (invoiceCounts[i.tenant_id] ?? 0) + 1
  }

  const result = (tenants ?? []).map((t) => ({
    ...t,
    user_count: userCounts[t.id] ?? 0,
    invoice_count: invoiceCounts[t.id] ?? 0,
  }))

  return Response.json(result)
}
