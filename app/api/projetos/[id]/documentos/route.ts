/**
 * Documentos de um projeto.
 * GET  - lista (filtrada para investidor)
 * POST - envia um ficheiro para a subpasta do projeto no Drive e grava os
 *        metadados. Os bytes nunca ficam na base de dados.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { log } from "@/lib/utils/audit"
import {
  ensureProjectFolder,
  getValidDriveToken,
  uploadFileToFolder,
} from "@/lib/google/drive"

export const runtime = "nodejs"
export const maxDuration = 120

/** Mesmo limite das faturas. */
const MAX_BYTES = 20 * 1024 * 1024

function admin(): SupabaseClient {
  // Cast: tabela da migration 043, ainda nao esta' em types/supabase.ts
  return createAdminClient() as unknown as SupabaseClient
}

/** Confirma que o investidor esta' associado a este projeto. */
async function investidorTemAcesso(userId: string, projectId: string): Promise<boolean> {
  const { getInvestidorProjectIds } = await import("@/lib/queries/investidores")
  const permitidos = await getInvestidorProjectIds(userId)
  return permitidos.includes(projectId)
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "projetos", "view_own")) return jsonError("Forbidden", 403)

  const ehInvestidor = ctx.role === "investidor"
  if (ehInvestidor && !(await investidorTemAcesso(ctx.userId, params.id))) {
    return jsonError("Forbidden", 403)
  }

  let q = admin()
    .from("project_documents")
    .select("id, name, mime_type, web_view_link, size_bytes, visibility, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })

  // Reforco na API do que a RLS ja' garante: o investidor so' ve os documentos
  // marcados para investidores.
  if (ehInvestidor) q = q.eq("visibility", "investidores")

  const { data, error } = await q
  if (error) return jsonError("Database error", 500, error.message)

  return Response.json({ documentos: data ?? [] })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  // Só quem gere projetos pode adicionar documentos. O investidor nunca escreve.
  if (ctx.role === "investidor" || !hasPermission(ctx.role, "projetos", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get("file") as File | null
  const nome = ((form?.get("name") as string | null) ?? "").trim()
  const visibility = (form?.get("visibility") as string | null) ?? "interna"

  if (!file) return jsonError("Ficheiro em falta", 400)
  if (!nome) return jsonError("Nome em falta", 400)
  if (visibility !== "interna" && visibility !== "investidores") {
    return jsonError("Visibilidade inválida", 400)
  }
  if (file.size > MAX_BYTES) {
    return jsonError("Ficheiro demasiado grande (máximo 20 MB)", 413)
  }

  const sb = admin()

  // Projeto tem de ser deste tenant
  const { data: projeto } = await sb
    .from("projects")
    .select("id, name")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!projeto) return jsonError("Projeto não encontrado", 404)

  const proj = projeto as { id: string; name: string }

  try {
    // Cria a subpasta se ainda nao existir (cobre projetos anteriores a esta
    // funcionalidade - criacao lazy no primeiro upload)
    const folderId = await ensureProjectFolder(ctx.tenantId, proj.id, proj.name)
    const token = await getValidDriveToken(ctx.tenantId)

    const bytes = Buffer.from(await file.arrayBuffer())
    const mime = file.type || "application/octet-stream"
    const ficheiro = await uploadFileToFolder(token, folderId, nome, mime, bytes)

    const { data: doc, error } = await sb
      .from("project_documents")
      .insert({
        tenant_id: ctx.tenantId,
        project_id: proj.id,
        name: nome,
        drive_file_id: ficheiro.id,
        mime_type: ficheiro.mimeType,
        web_view_link: ficheiro.webViewLink,
        size_bytes: ficheiro.size,
        visibility,
        uploaded_by: ctx.userId,
      })
      .select("id, name, mime_type, web_view_link, size_bytes, visibility, created_at")
      .single()

    if (error) return jsonError("Database error", 500, error.message)

    await log(sb, {
      action: "project_document.uploaded",
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      resourceType: "project",
      resourceId: proj.id,
      metadata: { name: nome, visibility },
    })

    return Response.json({ documento: doc }, { status: 201 })
  } catch (e) {
    // Propagar a mensagem real (ex: Drive nao ligado, token expirado) para o
    // utilizador conseguir agir, em vez de um erro generico.
    return jsonError(e instanceof Error ? e.message : "Falha ao enviar o documento", 502)
  }
}
