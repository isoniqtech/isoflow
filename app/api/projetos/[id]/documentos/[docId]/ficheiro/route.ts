/**
 * Proxy de preview/download de um documento.
 *
 * O ficheiro e' ido buscar ao Drive com o token do TENANT (server-side) e
 * devolvido em stream. O token nunca chega ao cliente e o utilizador nao
 * precisa de conta Google nem de permissoes no Drive.
 *
 * PDF e imagens abrem inline (preview); o resto descarrega.
 * ?download=1 forca sempre a descarga.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchFileContent, getValidDriveToken } from "@/lib/google/drive"

export const runtime = "nodejs"
export const maxDuration = 120

/** Tipos que fazem sentido pre-visualizar no browser. */
const INLINE_MIME = /^(application\/pdf|image\/(png|jpeg|jpg|gif|webp|svg\+xml)|text\/plain)$/i

export async function GET(
  req: Request,
  { params }: { params: { id: string; docId: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "projetos", "view_own")) return jsonError("Forbidden", 403)

  // Cast: tabela da migration 043, ainda nao esta' em types/supabase.ts
  const sb = createAdminClient() as unknown as SupabaseClient

  const { data } = await sb
    .from("project_documents")
    .select("id, name, mime_type, drive_file_id, visibility")
    .eq("id", params.docId)
    .eq("tenant_id", ctx.tenantId)
    .eq("project_id", params.id)
    .maybeSingle()

  const doc = data as {
    name: string
    mime_type: string | null
    drive_file_id: string
    visibility: string
  } | null
  if (!doc) return jsonError("Documento não encontrado", 404)

  // Investidor: so' documentos marcados para investidores E so' dos projetos a
  // que esta' associado. (A RLS ja' garante o mesmo; aqui e' o reforco na API,
  // porque esta rota usa o cliente admin.)
  if (ctx.role === "investidor") {
    if (doc.visibility !== "investidores") return jsonError("Forbidden", 403)
    const { getInvestidorProjectIds } = await import("@/lib/queries/investidores")
    const permitidos = await getInvestidorProjectIds(ctx.userId)
    if (!permitidos.includes(params.id)) return jsonError("Forbidden", 403)
  }

  let upstream: Response
  try {
    const token = await getValidDriveToken(ctx.tenantId)
    upstream = await fetchFileContent(token, doc.drive_file_id)
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Falha ao obter o ficheiro", 502)
  }

  const { searchParams } = new URL(req.url)
  const forcarDownload = searchParams.get("download") === "1"
  const mime = doc.mime_type ?? upstream.headers.get("content-type") ?? "application/octet-stream"
  const inline = !forcarDownload && INLINE_MIME.test(mime)

  // Nome seguro para o header (evita quebrar com acentos ou aspas)
  const nomeAscii = doc.name.replace(/["\\]/g, "").replace(/[^\x20-\x7E]/g, "_")
  const disposition =
    `${inline ? "inline" : "attachment"}; filename="${nomeAscii}"; ` +
    `filename*=UTF-8''${encodeURIComponent(doc.name)}`

  const headers = new Headers()
  headers.set("Content-Type", mime)
  headers.set("Content-Disposition", disposition)
  headers.set("Cache-Control", "private, max-age=60")
  const len = upstream.headers.get("content-length")
  if (len) headers.set("Content-Length", len)

  return new Response(upstream.body, { status: 200, headers })
}
