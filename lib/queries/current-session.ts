import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSuperAdmin } from "@/lib/supabase/admin"
import type { UserRole } from "@/types"

export type TenantSummary = {
  id: string
  name: string
  logo_url: string | null
  primary_color: string
  app_name: string
  role: UserRole
  is_primary: boolean
}

export type CurrentSession = {
  user: {
    id: string
    email: string
    name: string
    avatar_url: string | null
    is_super_admin: boolean
  }
  tenant: {
    id: string
    name: string
    nif: string | null
    logo_url: string | null
    primary_color: string
    app_name: string
    plan: string
    credits_balance: number
    credits_used_this_month: number
    onboarding_completed: boolean
  }
  role: UserRole
  availableTenants: TenantSummary[]
}

export const getCurrentSession = cache(
  async (): Promise<CurrentSession | null> => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id, role, name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
    if (!profile) return null

    const primaryTenantId = profile.tenant_id

    // Determinar tenant activo (pode ser diferente do primario via switch)
    const activeTenantId: string =
      (user.app_metadata?.active_tenant_id as string | undefined) ?? primaryTenantId

    // Carregar dados do tenant activo
    const { data: tenant } = await supabase
      .from("tenants")
      .select(
        "id, name, nif, logo_url, primary_color, app_name, plan, credits_balance, credits_used_this_month, onboarding_completed",
      )
      .eq("id", activeTenantId)
      .maybeSingle()
    if (!tenant) return null

    // Determinar role no tenant activo
    let activeRole: UserRole = profile.role as UserRole
    if (activeTenantId !== primaryTenantId) {
      const admin = createAdminClient()
      const { data: membership } = await admin
        .from("tenant_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", activeTenantId)
        .eq("status", "active")
        .maybeSingle()
      if (membership) activeRole = (membership as { role: string }).role as UserRole
    }

    // Carregar todos os tenants disponiveis (primario + memberships activas)
    const admin = createAdminClient()
    const { data: memberships } = await admin
      .from("tenant_memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")

    const extraTenantIds = (memberships ?? [])
      .map((m) => (m as { tenant_id: string; role: string }).tenant_id)
      .filter((id) => id !== primaryTenantId)

    const allTenantIds = [primaryTenantId, ...extraTenantIds]

    const { data: allTenants } = await admin
      .from("tenants")
      .select("id, name, logo_url, primary_color, app_name")
      .in("id", allTenantIds)

    const availableTenants: TenantSummary[] = (allTenants ?? []).map((t) => {
      const membership = (memberships ?? []).find(
        (m) => (m as { tenant_id: string }).tenant_id === t.id,
      ) as { tenant_id: string; role: string } | undefined
      const isPrimary = t.id === primaryTenantId
      return {
        id: t.id,
        name: t.name,
        logo_url: t.logo_url ?? null,
        primary_color: t.primary_color ?? "#2563EB",
        app_name: t.app_name ?? "ISOFlow",
        role: isPrimary ? (profile.role as UserRole) : ((membership?.role ?? "member") as UserRole),
        is_primary: isPrimary,
      }
    })

    return {
      user: {
        id: user.id,
        email: user.email ?? "",
        name: profile.name,
        avatar_url: profile.avatar_url,
        is_super_admin: isSuperAdmin(user.id),
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        nif: tenant.nif,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color ?? "#2563EB",
        app_name: tenant.app_name ?? "ISOFlow",
        plan: tenant.plan ?? "starter",
        credits_balance: tenant.credits_balance ?? 0,
        credits_used_this_month: tenant.credits_used_this_month ?? 0,
        onboarding_completed: tenant.onboarding_completed ?? false,
      },
      role: activeRole,
      availableTenants,
    }
  },
)
