/**
 * Estado e desligamento da integração Google Drive do tenant.
 * GET    - estado da ligação (nunca devolve tokens)
 * DELETE - desliga e apaga os tokens
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { getGoogleClientId, getGoogleClientSecret, ROOT_FOLDER_NAME } from "@/lib/google/drive"

export const runtime = "nodejs"

function admin(): SupabaseClient {
  // Cast: tabela da migration 041, ainda nao esta' em types/supabase.ts
  return createAdminClient() as unknown as SupabaseClient
}

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "view_all")) return jsonError("Forbidden", 403)

  const { data } = await admin()
    .from("google_drive_integrations")
    .select("refresh_token_encrypted, token_expiry, root_folder_id, connected_at, scope, sync_error")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()

  const row = data as {
    refresh_token_encrypted: string | null
    token_expiry: string | null
    root_folder_id: string | null
    connected_at: string | null
    scope: string | null
    sync_error: string | null
  } | null

  return Response.json({
    configuravel: Boolean(getGoogleClientId() && getGoogleClientSecret()),
    ligado: Boolean(row?.refresh_token_encrypted),
    pasta_raiz: ROOT_FOLDER_NAME,
    tem_pasta_raiz: Boolean(row?.root_folder_id),
    ligado_em: row?.connected_at ?? null,
    scope: row?.scope ?? null,
    sync_error: row?.sync_error ?? null,
  })
}

export async function DELETE() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) return jsonError("Forbidden", 403)

  const { error } = await admin()
    .from("google_drive_integrations")
    .delete()
    .eq("tenant_id", ctx.tenantId)

  if (error) return jsonError("Database error", 500, error.message)
  return Response.json({ ok: true })
}
