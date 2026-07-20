import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"

const schema = z.object({
  notes: z.string().trim().max(2000).nullable(),
})

/**
 * PATCH /api/banco/transactions/[id]
 * Guarda a nota de texto livre de um movimento bancario.
 * A nota flui depois para o campo "notes" do documento TOConline
 * (via fatura conciliada) para o contabilista.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  // Quem vê o banco (owner/admin/accountant) pode anotar movimentos.
  if (!hasPermission(ctx.role, "banco", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const notes = parsed.data.notes && parsed.data.notes.length > 0 ? parsed.data.notes : null

  const supabase = createClient()
  const { data, error } = await supabase
    .from("bank_transactions")
    .update({ notes })
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .select("id, notes")
    .maybeSingle()

  if (error) return jsonError("Falha ao guardar nota", 500, error.message)
  if (!data) return jsonError("Movimento não encontrado", 404)

  await log(supabase, {
    action: "bank_transaction.note_updated",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "bank_transaction",
    resourceId: params.id,
    metadata: { has_note: notes !== null },
  })

  return Response.json({ data })
}
