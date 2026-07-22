/**
 * Apagar um documento do projeto (do Drive e da base de dados).
 * Só quem gere projetos. O investidor nunca apaga.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { log } from "@/lib/utils/audit"
import { deleteDriveFile, getValidDriveToken } from "@/lib/google/drive"

export const runtime = "nodejs"

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; docId: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (ctx.role === "investidor" || !hasPermission(ctx.role, "projetos", "edit")) {
    return jsonError("Forbidden", 403)
  }

  // Cast: tabela da migration 043, ainda nao esta' em types/supabase.ts
  const sb = createAdminClient() as unknown as SupabaseClient

  const { data } = await sb
    .from("project_documents")
    .select("id, drive_file_id, name")
    .eq("id", params.docId)
    .eq("tenant_id", ctx.tenantId)
    .eq("project_id", params.id)
    .maybeSingle()

  const doc = data as { id: string; drive_file_id: string; name: string } | null
  if (!doc) return jsonError("Documento não encontrado", 404)

  // Apagar no Drive. Se falhar, nao removemos o registo - senao ficava um
  // ficheiro orfao no Drive sem forma de lhe chegar pela app.
  try {
    const token = await getValidDriveToken(ctx.tenantId)
    await deleteDriveFile(token, doc.drive_file_id)
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Falha ao apagar no Google Drive",
      502,
    )
  }

  const { error } = await sb.from("project_documents").delete().eq("id", doc.id)
  if (error) return jsonError("Database error", 500, error.message)

  await log(sb, {
    action: "project_document.deleted",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "project",
    resourceId: params.id,
    metadata: { name: doc.name },
  })

  return Response.json({ ok: true })
}
