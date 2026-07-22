/**
 * Configura as credenciais TOConline Direct por tenant.
 * Guarda client_id, client_secret (cifrado), access/refresh tokens (cifrados),
 * e subdomain no config jsonb.
 * Acesso restrito a owner/admin (integracao.manage).
 */
import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createClient } from "@/lib/supabase/server"
import { encrypt, decryptOptional } from "@/lib/utils/encryption"

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("tenant_integrations")
    .select(
      "toconline_client_id, toconline_client_secret_encrypted, api_key_encrypted, api_secret_encrypted, toconline_token_expires_at, config, is_active, last_sync_at, sync_error",
    )
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()

  if (error) return jsonError("Database error", 500, error.message)
  if (!data) return Response.json({ configured: false })

  const config = (data.config ?? {}) as Record<string, unknown>

  return Response.json({
    configured: true,
    client_id: data.toconline_client_id ?? null,
    has_client_secret: !!data.toconline_client_secret_encrypted,
    has_access_token: !!data.api_key_encrypted,
    has_refresh_token: !!data.api_secret_encrypted,
    token_expires_at: data.toconline_token_expires_at ?? null,
    subdomain: config.subdomain ?? null,
    is_active: data.is_active,
    last_sync_at: data.last_sync_at,
    sync_error: data.sync_error,
  })
}

const saveSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive().default(3600),
  subdomain: z.union([z.string().min(1), z.number()]),
})

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const { client_id, client_secret, access_token, refresh_token, expires_in, subdomain } =
    parsed.data

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

  const supabase = createClient()

  // Preservar o config existente (redirect_uri, default_expense_category, ...)
  // e so' actualizar o subdomain - antes reescrevia o objecto inteiro.
  const { data: existing } = await supabase
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()
  const config = {
    ...((existing?.config ?? {}) as Record<string, unknown>),
    subdomain: String(subdomain),
  }

  const { error } = await supabase.from("tenant_integrations").upsert(
    {
      tenant_id: ctx.tenantId,
      type: "erp",
      provider: "toconline",
      toconline_client_id: client_id,
      toconline_client_secret_encrypted: encrypt(client_secret),
      api_key_encrypted: encrypt(access_token),
      api_secret_encrypted: encrypt(refresh_token),
      toconline_token_expires_at: expiresAt,
      config,
      is_active: true,
      sync_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,type,provider" },
  )

  if (error) return jsonError("Database error", 500, error.message)

  return Response.json({ ok: true })
}

export async function DELETE() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { error } = await supabase
    .from("tenant_integrations")
    .update({
      is_active: false,
      sync_error: "Desativado pelo utilizador",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")

  if (error) return jsonError("Database error", 500, error.message)

  return Response.json({ ok: true })
}
