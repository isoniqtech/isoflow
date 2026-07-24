import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasPermission } from "@/lib/utils/permissions"
import { createFC } from "@/lib/toconline/fc"
import { PRE_ERP_STATUSES } from "@/lib/utils/invoice-status"

const bodySchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(50),
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

  const supabase = createClient()
  const tenantId = session.tenant.id

  // Buscar faturas elegíveis
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, supplier_name, supplier_nif, invoice_number, invoice_date, subtotal, vat_rate, vat_amount, total, description, currency, toconline_fc_id, bank_transaction_id, expense_category_code")
    .eq("tenant_id", tenantId)
    .in("id", parsed.data.invoice_ids)

  if (error || !invoices?.length)
    return NextResponse.json({ error: "Faturas nao encontradas" }, { status: 404 })

  const pending = invoices.filter((inv) => !inv.toconline_fc_id)
  const alreadyDone = invoices.length - pending.length

  if (!pending.length)
    return NextResponse.json({ queued: 0, skipped: alreadyDone })

  // Notas dos movimentos bancarios conciliados (para anexar ao FC no TOConline)
  const bankTxIds = pending
    .map((inv) => inv.bank_transaction_id)
    .filter((v): v is string => Boolean(v))
  const noteByTxId = new Map<string, string>()
  if (bankTxIds.length) {
    const { data: txNotes } = await supabase
      .from("bank_transactions")
      .select("id, notes")
      .eq("tenant_id", tenantId)
      .in("id", bankTxIds)
    for (const t of txNotes ?? []) {
      if (t.notes && t.notes.trim().length > 0) noteByTxId.set(t.id, t.notes)
    }
  }
  const noteForInvoice = (inv: { bank_transaction_id: string | null }): string | null =>
    inv.bank_transaction_id ? noteByTxId.get(inv.bank_transaction_id) ?? null : null

  // -------------------------------------------------------------------
  // Criar FC via app - os DOIS modos (direto por OAuth, n8n pelo proxy).
  // O fc.ts trata dedup -> fornecedor -> criar FC e devolve o numero na hora,
  // por isso ja NAO ha' forward ao webhook n8n nem callback /update-fc.
  // -------------------------------------------------------------------
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const errors: string[] = []
  let created = 0
  let skipped = alreadyDone

  await Promise.all(
    pending.map(async (inv) => {
      try {
        const result = await createFC(tenantId, {
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.invoice_date,
          supplierNif: inv.supplier_nif,
          supplierName: inv.supplier_name,
          subtotal: inv.subtotal !== null ? Number(inv.subtotal) : null,
          description: inv.description,
          movementNote: noteForInvoice(inv),
          vatRate: inv.vat_rate !== null ? Number(inv.vat_rate) : null,
          expenseCategoryCode: inv.expense_category_code ?? null,
        })

        // Gravar fc_number - mesma logica que /api/faturas/[id]/update-fc
        await admin
          .from("invoices")
          .update({
            toconline_fc_id: result.fcNumber,
            erp_synced: true,
            erp_synced_at: now,
            updated_at: now,
          })
          .eq("id", inv.id)
          .eq("tenant_id", tenantId)

        // Promover o estado so' a partir de fases anteriores ao ERP
        await admin
          .from("invoices")
          .update({ status: "enviada_erp", updated_at: now })
          .eq("id", inv.id)
          .eq("tenant_id", tenantId)
          .in("status", PRE_ERP_STATUSES as unknown as string[])

        if (result.alreadyExisted) skipped++
        else created++
      } catch (e) {
        errors.push(
          `${inv.invoice_number ?? inv.id}: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }),
  )

  return NextResponse.json({ queued: created, skipped, errors })
}
