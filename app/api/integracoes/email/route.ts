import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt } from "@/lib/utils/encryption"
import { log } from "@/lib/utils/audit"

export const runtime = "nodejs"

const saveSchema = z.object({
  provider: z.enum(["gmail", "outlook", "imap"]),
  email: z.string().email(),
  appPassword: z.string().min(1).optional().nullable(),
  imapHost: z.string().optional().nullable(),
  imapPort: z.number().int().positive().optional().nullable(),
  tag: z.string().optional().nullable(),
})

type IntegrationConfig = {
  provider: "gmail" | "outlook" | "imap"
  email: string
  imapHost?: string | null
  imapPort?: number | null
  tag?: string | null
}

/**
 * Retorna a integração de email do tenant (se existir), sem expor a app
 * password. Apenas owner/admin podem ver/editar.
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
    .select("id, config, is_active, last_sync_at, sync_error, created_at, updated_at")
    .eq("type", "email")
    .eq("provider", "imap")
    .maybeSingle()

  if (!data) return Response.json({ data: null })

  const config = (data.config ?? {}) as IntegrationConfig
  return Response.json({
    data: {
      id: data.id,
      provider: config.provider,
      email: config.email,
      imapHost: config.imapHost ?? null,
      imapPort: config.imapPort ?? null,
      tag: config.tag ?? null,
      is_active: data.is_active,
      last_sync_at: data.last_sync_at,
      sync_error: data.sync_error,
      has_password: true,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  })
}

/**
 * Cria ou atualiza a integração de email IMAP. Encripta a app password.
 * Se `appPassword` vier null/undefined no update, mantém a anterior.
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

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Configuração do servidor incompleta", 500)
  }

  const supabase = createClient()

  const { data: existing } = await supabase
    .from("tenant_integrations")
    .select("id, api_key_encrypted")
    .eq("type", "email")
    .eq("provider", "imap")
    .maybeSingle()

  const newConfig: IntegrationConfig = {
    provider: parsed.provider,
    email: parsed.email,
    imapHost: parsed.imapHost ?? null,
    imapPort: parsed.imapPort ?? null,
    tag: parsed.tag ?? null,
  }

  let api_key_encrypted: string | null = existing?.api_key_encrypted ?? null
  if (parsed.appPassword) {
    try {
      const cleaned = parsed.appPassword.replace(/\s+/g, "")
      api_key_encrypted = encrypt(cleaned)
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Erro ao encriptar credenciais", 500)
    }
  }
  if (!api_key_encrypted) {
    return jsonError("App password é obrigatória na primeira gravação", 400)
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
      type: "email",
      provider: "imap",
      api_key_encrypted,
      config: newConfig,
      is_active: true,
    })
    if (error) return jsonError(error.message, 500)
  }

  await log(admin, {
    action: existing ? "email_integration.updated" : "email_integration.created",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "tenant_integration",
    metadata: { provider: parsed.provider, email: parsed.email },
  })

  return Response.json({ ok: true })
}

/**
 * Desativa (não apaga) a integração de email. Mantém o registo para histórico.
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
    .eq("type", "email")
    .eq("provider", "imap")
  if (error) return jsonError(error.message, 500)

  await log(admin, {
    action: "email_integration.disabled",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "tenant_integration",
  })

  return Response.json({ ok: true })
}
