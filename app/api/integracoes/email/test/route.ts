import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import {
  testConnection,
  type EmailCredentials,
  type EmailProvider,
} from "@/lib/email/gmail-imap"

export const runtime = "nodejs"

const bodySchema = z.object({
  provider: z.enum(["gmail", "outlook", "imap"]),
  email: z.string().email(),
  appPassword: z.string().min(1, "App password obrigatória"),
  imapHost: z.string().optional().nullable(),
  imapPort: z.number().int().positive().optional().nullable(),
  tag: z.string().optional().nullable(),
})

/**
 * Testa as credenciais IMAP. Não persiste nada — apenas abre INBOX e fecha.
 * Devolve { ok: true } ou { ok: false, error: '...' }.
 *
 * Apenas owner/admin podem testar (são os únicos que vão guardar credenciais).
 */
export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch (e) {
    return jsonError("Payload inválido", 400, (e as z.ZodError).flatten())
  }

  const credentials: EmailCredentials = {
    provider: parsed.provider as EmailProvider,
    email: parsed.email,
    appPassword: parsed.appPassword,
    imapHost: parsed.imapHost ?? undefined,
    imapPort: parsed.imapPort ?? undefined,
    tag: parsed.tag ?? null,
  }

  const result = await testConnection(credentials)
  if (!result.success) {
    return Response.json({ ok: false, error: result.error })
  }
  return Response.json({ ok: true })
}
