import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/types"

export type ApiContext = {
  userId: string
  email: string
  tenantId: string
  role: UserRole
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

  return {
    userId: user.id,
    email: user.email ?? "",
    tenantId: profile.tenant_id,
    role: (profile.role ?? "member") as UserRole,
  }
}

export function jsonError(message: string, status: number, details?: unknown) {
  return Response.json(
    { error: message, ...(details !== undefined ? { details } : {}) },
    { status },
  )
}
