import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt } from "@/lib/utils/encryption"
import { log } from "@/lib/utils/audit"

export const runtime = "nodejs"

const saveSchema = z.object({
  url: z.string().url({ message: "URL inválido" }),
  secret: z.string().min(8).optional().nullable(),
})

type ErpConfig = {
  url: string
}

/**
 * Devolve a integração ERP/n8n actual (sem expor o secret).
 */
export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { data } = await supabase
    .from("tenant_integrations")
    .select(
      "id, config, is_active, last_sync_at, sync_error, api_key_encrypted, created_at, updated_at",
    )
    .eq("type", "erp")
    .eq("provider", "n8n")
    .maybeSingle()

  if (!data) return Response.json({ data: null })

  const cfg = (data.config ?? {}) as ErpConfig
  return Response.json({
    data: {
      id: data.id,
      url: cfg.url ?? "",
      has_secret: Boolean(data.api_key_encrypted),
      is_active: data.is_active,
      last_sync_at: data.last_sync_at,
      sync_error: data.sync_error,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  })
}

/**
 * Cria/atualiza a integração ERP/n8n. O secret é encriptado (AES-256-GCM)
 * em api_key_encrypted; só a URL fica em plaintext no config.
 *
 * Se o secret for omitido no update, mantém o anterior.
 */
export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  let parsed: z.infer<typeof saveSchema>
  try {
    parsed = saveSchema.parse(await req.json())
  } catch (e) {
    return jsonError("Payload inválido", 400, (e as z.ZodError).flatten())
  }

  const admin = createAdminClient()
  const supabase = createClient()

  const { data: existing } = await supabase
    .from("tenant_integrations")
    .select("id, api_key_encrypted")
    .eq("type", "erp")
    .eq("provider", "n8n")
    .maybeSingle()

  const newConfig: ErpConfig = { url: parsed.url }

  let api_key_encrypted: string | null = existing?.api_key_encrypted ?? null
  if (parsed.secret) {
    api_key_encrypted = encrypt(parsed.secret)
  }

  if (existing) {
    const { error } = await admin
      .from("tenant_integrations")
      .update({
        api_key_encrypted,
        config: newConfig,
        is_active: true,
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
    if (error) return jsonError(error.message, 500)
  } else {
    const { error } = await admin.from("tenant_integrations").insert({
      tenant_id: ctx.tenantId,
      type: "erp",
      provider: "n8n",
      api_key_encrypted,
      config: newConfig,
      is_active: true,
    })
    if (error) return jsonError(error.message, 500)
  }

  await log(admin, {
    action: existing ? "erp_integration.updated" : "erp_integration.created",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "tenant_integration",
    metadata: { url: parsed.url },
  })

  return Response.json({ ok: true })
}

/**
 * Desativa a integração ERP. Mantém o registo para histórico.
 */
export async function DELETE() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "delete")) {
    return jsonError("Forbidden", 403)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("tenant_integrations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "erp")
    .eq("provider", "n8n")
  if (error) return jsonError(error.message, 500)

  await log(admin, {
    action: "erp_integration.disabled",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "tenant_integration",
  })

  return Response.json({ ok: true })
}
