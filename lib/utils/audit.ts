import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

type Client = SupabaseClient<Database>

export async function log(
  supabase: Client,
  params: {
    action: string
    tenantId: string
    userId: string | null
    resourceType?: string
    resourceId?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    action: params.action,
    tenant_id: params.tenantId,
    user_id: params.userId,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    metadata: (params.metadata ?? {}) as never,
  })

  if (error) {
    console.warn("audit log failed:", params.action, error.message)
  }
}
