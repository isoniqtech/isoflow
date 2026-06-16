import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/types"

export type ApiContext = {
  userId: string
  email: string
  tenantId: string
  role: UserRole
  creditsBalance: number
  plan: string
}

export async function getApiContext(): Promise<ApiContext | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile) return null

  const { data: tenant } = await supabase
    .from("tenants")
    .select("status, trial_ends_at, credits_balance, plan")
    .eq("id", profile.tenant_id)
    .maybeSingle()
  if (!tenant) return null

  if (tenant.status === "cancelled" || tenant.status === "suspended") return null
  if (
    tenant.status === "trial" &&
    tenant.trial_ends_at &&
    new Date(tenant.trial_ends_at) < new Date()
  ) return null

  return {
    userId: user.id,
    email: user.email ?? "",
    tenantId: profile.tenant_id,
    role: (profile.role ?? "member") as UserRole,
    creditsBalance: tenant.credits_balance ?? 0,
    plan: tenant.plan ?? "starter",
  }
}

export function jsonError(message: string, status: number, details?: unknown) {
  return Response.json(
    { error: message, ...(details !== undefined ? { details } : {}) },
    { status },
  )
}
