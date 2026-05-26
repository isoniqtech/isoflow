import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"

const bodySchema = z.object({
  invoice_id:     z.string().uuid(),
  efatura_doc_id: z.string().uuid(),
})

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(session.role, "faturas", "edit"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const { invoice_id, efatura_doc_id } = parsed.data
  const supabase = createClient()

  // Verificar que ambos pertencem ao tenant
  const [{ data: invoice }, { data: doc }] = await Promise.all([
    supabase.from("invoices").select("id, toconline_fc_id").eq("id", invoice_id).eq("tenant_id", session.tenant.id).single(),
    supabase.from("efatura_documents").select("id").eq("id", efatura_doc_id).eq("tenant_id", session.tenant.id).single(),
  ])

  if (!invoice) return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
  if (!doc)     return NextResponse.json({ error: "Documento e-Fatura não encontrado" }, { status: 404 })
  if (!invoice.toconline_fc_id)
    return NextResponse.json({ error: "Fatura sem FC — cria primeiro a FC no Toconline" }, { status: 422 })

  const now = new Date().toISOString()

  // Associar o documento e-Fatura à fatura
  const [r1, r2] = await Promise.all([
    supabase
      .from("efatura_documents")
      .update({ invoice_id, matched_at: now, matched_by: "manual", updated_at: now })
      .eq("id", efatura_doc_id)
      .eq("tenant_id", session.tenant.id),

    // Marcar fatura como at_communicated (compra registada — pendente manual no Toconline)
    supabase
      .from("invoices")
      .update({ at_communicated: true, at_communicated_at: now })
      .eq("id", invoice_id)
      .eq("tenant_id", session.tenant.id),
  ])

  if (r1.error || r2.error) {
    return NextResponse.json(
      { error: r1.error?.message ?? r2.error?.message ?? "Erro ao associar" },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
