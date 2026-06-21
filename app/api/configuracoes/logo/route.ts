import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"

const BUCKET = "tenant-assets"
const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "configuracoes", "edit")) return jsonError("Forbidden", 403)

  const form = await req.formData().catch(() => null)
  if (!form) return jsonError("Formulario inválido", 400)

  const file = form.get("logo") as File | null
  if (!file) return jsonError("Ficheiro em falta", 400)
  if (!ALLOWED.includes(file.type)) return jsonError("Tipo de ficheiro não suportado. Usa PNG, JPG, WebP ou SVG.", 400)
  if (file.size > MAX_SIZE) return jsonError("Ficheiro demasiado grande. Máximo 2MB.", 400)

  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1]
  const path = `${ctx.tenantId}/logo.${ext}`

  const admin = createAdminClient()
  const bytes = await file.arrayBuffer()

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadErr) return jsonError("Erro ao guardar imagem", 500, uploadErr.message)

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)

  const { error: dbErr } = await admin
    .from("tenants")
    .update({ logo_path: path, logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", ctx.tenantId)

  if (dbErr) return jsonError("Erro ao actualizar tenant", 500, dbErr.message)

  return Response.json({ url: publicUrl })
}

export async function DELETE() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "configuracoes", "edit")) return jsonError("Forbidden", 403)

  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from("tenants")
    .select("logo_path")
    .eq("id", ctx.tenantId)
    .single()

  if (tenant?.logo_path) {
    await admin.storage.from(BUCKET).remove([tenant.logo_path])
  }

  await admin
    .from("tenants")
    .update({ logo_path: null, logo_url: null, updated_at: new Date().toISOString() })
    .eq("id", ctx.tenantId)

  return Response.json({ ok: true })
}
