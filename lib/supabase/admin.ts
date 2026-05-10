import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

/**
 * Cliente Supabase com service_role key — bypassa RLS.
 * Usar APENAS em código server-side autorizado (admin panel).
 * Nunca exportar para o cliente nem usar em routes públicas.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    )
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function isSuperAdmin(userId: string | null | undefined): boolean {
  const id = process.env.SUPER_ADMIN_USER_ID
  return Boolean(id && userId && id === userId)
}
