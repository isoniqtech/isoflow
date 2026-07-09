import { createHmac } from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasPermission } from "@/lib/utils/permissions"
import { encrypt } from "@/lib/utils/encryption"

const bodySchema = z.object({
  subdomain: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
})

function makeState(tenantId: string): string {
  const payload = `${tenantId}:${Date.now()}`
  const sig = createHmac("sha256", process.env.ENCRYPTION_KEY!).update(payload).digest("hex")
  return Buffer.from(`${payload}:${sig}`).toString("base64url")
}

export async function POST(req: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(session.role, "integracoes", "edit"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: "Campos em falta" }, { status: 400 })

  const { subdomain, client_id, client_secret } = parsed.data
  const tenantId = session.tenant.id
  const admin = createAdminClient()

  // Guardar credenciais temporariamente (is_active false ate callback)
  await admin.from("tenant_integrations").upsert(
    {
      tenant_id: tenantId,
      type: "erp",
      provider: "toconline",
      is_active: false,
      toconline_client_id: client_id,
      toconline_client_secret_encrypted: encrypt(client_secret),
      config: { subdomain: String(subdomain), oauth_pending: true },
      sync_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,type,provider" },
  )

  const state = makeState(tenantId)
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/toconline/oauth/callback`
  const appBase = `https://app${subdomain}.toconline.pt`
  const authUrl =
    `${appBase}/oauth/auth` +
    `?client_id=${encodeURIComponent(client_id)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=commercial` +
    `&state=${encodeURIComponent(state)}`

  return NextResponse.json({ redirect_url: authUrl })
}
