import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(session.role, "faturas", "edit"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = createClient()
  const tenantId = session.tenant.id
  const now = new Date().toISOString()

  // Buscar faturas incoming com FC do Toconline atribuída
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, toconline_fc_id")
    .eq("tenant_id", tenantId)
    .eq("type", "incoming")
    .neq("status", "rejected")
    .not("toconline_fc_id", "is", null)

  // Buscar docs e-Fatura ainda não associados
  const { data: efaturaDocs } = await supabase
    .from("efatura_documents")
    .select("id, document_number")
    .eq("tenant_id", tenantId)
    .is("invoice_id", null)

  if (!invoices?.length || !efaturaDocs?.length) {
    return NextResponse.json({ matched: 0, message: "Nada para conciliar" })
  }

  // Índice: document_number (número FC) → efatura_doc id
  const docMap = new Map<string, string>()
  for (const doc of efaturaDocs) {
    if (doc.document_number) docMap.set(doc.document_number.trim(), doc.id)
  }

  let matched = 0
  const errors: string[] = []

  for (const inv of invoices) {
    // Corresponder pelo número FC do Toconline (toconline_fc_id === document_number)
    const efaturaDocId = docMap.get((inv.toconline_fc_id ?? "").trim())
    if (!efaturaDocId) continue

    const [r1, r2] = await Promise.all([
      // Associar doc e-Fatura à fatura
      supabase
        .from("efatura_documents")
        .update({ invoice_id: inv.id, matched_at: now, matched_by: "auto", updated_at: now })
        .eq("id", efaturaDocId)
        .eq("tenant_id", tenantId),

      // Marcar fatura como comunicada AT + atualizar status se tiver FC
      supabase
        .from("invoices")
        .update({
          at_communicated: true,
          at_communicated_at: now,
          ...(inv.toconline_fc_id ? { status: "enviada_erp" } : {}),
        })
        .eq("id", inv.id)
        .eq("tenant_id", tenantId),
    ])

    if (r1.error || r2.error) {
      errors.push(`${inv.invoice_number}: ${r1.error?.message ?? r2.error?.message}`)
    } else {
      matched++
    }
  }

  return NextResponse.json({ matched, errors })
}
