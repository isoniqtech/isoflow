import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { isSuperAdmin } from "@/lib/supabase/admin"
import type { UserRole } from "@/types"

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

    const { data: tenant } = await supabase
      .from("tenants")
      .select(
        "id, name, nif, logo_url, primary_color, app_name, plan, credits_balance, credits_used_this_month, onboarding_completed",
      )
      .eq("id", profile.tenant_id)
      .maybeSingle()
    if (!tenant) return null

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
      role: (profile.role ?? "member") as UserRole,
    }
  },
)
