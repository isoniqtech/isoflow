import { createClient } from "@/lib/supabase/server"
import { isSuperAdmin } from "@/lib/supabase/admin"

export async function requireSuperAdmin(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!isSuperAdmin(user.id)) return null
  return user.id
}
