import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt } from "@/lib/utils/encryption"
import { z } from "zod"

const Schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("activate"),
    account_sid: z.string().min(1, "Account SID obrigatorio"),
    auth_token: z.string().min(1, "Auth Token obrigatorio"),
    phone_number: z.string().min(1, "Numero WhatsApp obrigatorio"),
  }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("deactivate") }),
])

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Parametros invalidos", 400)
  }

  const admin = createAdminClient()

  if (parsed.data.action === "deactivate") {
    const { error } = await admin
      .from("tenant_integrations")
      .update({ is_active: false })
      .eq("tenant_id", ctx.tenantId)
      .eq("type", "whatsapp")
      .eq("provider", "twilio")

    if (error) return jsonError(error.message, 500)
    return Response.json({ ok: true, is_active: false })
  }

  if (parsed.data.action === "reactivate") {
    const { error } = await admin
      .from("tenant_integrations")
      .update({ is_active: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("type", "whatsapp")
      .eq("provider", "twilio")

    if (error) return jsonError(error.message, 500)
    return Response.json({ ok: true, is_active: true })
  }

  // activate: encrypt and store credentials
  const { account_sid, auth_token, phone_number } = parsed.data

  const { error } = await admin
    .from("tenant_integrations")
    .upsert(
      {
        tenant_id: ctx.tenantId,
        type: "whatsapp",
        provider: "twilio",
        is_active: true,
        api_key_encrypted: encrypt(account_sid),
        api_secret_encrypted: encrypt(auth_token),
        config: { phone_number },
      },
      { onConflict: "tenant_id,type,provider" },
    )

  if (error) return jsonError(error.message, 500)
  return Response.json({ ok: true, is_active: true })
}
