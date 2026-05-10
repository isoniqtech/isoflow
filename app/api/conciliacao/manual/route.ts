import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"

const schema = z.object({
  action: z.enum(["confirm", "reject", "create"]),
  invoice_id: z.string().uuid(),
  bank_transaction_id: z.string().uuid(),
  reconciliation_id: z.string().uuid().optional(),
  rejection_reason: z.string().max(500).optional(),
})

/**
 * Ações manuais sobre reconciliations:
 *  - create: cria novo match (status=confirmed) e marca invoice + bank tx
 *  - confirm: aceita uma sugestão pendente
 *  - reject: rejeita uma sugestão pendente (mantém invoice/bank sem alteração)
 */
export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "conciliacao", "create")) {
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
  const input = parsed.data
  const supabase = createClient()

  // Verifica que invoice + bank_tx pertencem ao tenant (defensivo, RLS já filtra)
  const [{ data: invoice }, { data: tx }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, status")
      .eq("id", input.invoice_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
    supabase
      .from("bank_transactions")
      .select("id, invoice_id")
      .eq("id", input.bank_transaction_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
  ])
  if (!invoice || !tx) return jsonError("Recursos não encontrados", 404)

  if (input.action === "reject") {
    if (!input.reconciliation_id) {
      return jsonError("reconciliation_id obrigatório para reject", 400)
    }
    const { error } = await supabase
      .from("reconciliations")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejected_by: ctx.userId,
        rejection_reason: input.rejection_reason ?? null,
      })
      .eq("id", input.reconciliation_id)
      .eq("tenant_id", ctx.tenantId)
    if (error) return jsonError("Falha ao rejeitar", 500, error.message)
    await log(supabase, {
      action: "reconciliation.rejected",
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      resourceType: "reconciliation",
      resourceId: input.reconciliation_id,
    })
    return Response.json({ data: { ok: true } })
  }

  // confirm ou create — mesma lógica final, difere se há reconciliation_id existente
  if (tx.invoice_id && tx.invoice_id !== input.invoice_id) {
    return jsonError(
      "Este movimento já está conciliado com outra fatura",
      409,
    )
  }
  if (invoice.status === "matched" || invoice.status === "paid") {
    return jsonError("Esta fatura já está conciliada", 409)
  }

  let reconciliationId = input.reconciliation_id
  if (input.action === "confirm" && reconciliationId) {
    // Aceita a sugestão pending
    const { error } = await supabase
      .from("reconciliations")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: ctx.userId,
      })
      .eq("id", reconciliationId)
      .eq("tenant_id", ctx.tenantId)
    if (error) return jsonError("Falha ao confirmar", 500, error.message)
  } else {
    // create: nova reconciliation
    const { data: created, error } = await supabase
      .from("reconciliations")
      .insert({
        tenant_id: ctx.tenantId,
        invoice_id: input.invoice_id,
        bank_transaction_id: input.bank_transaction_id,
        match_type: "manual",
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: ctx.userId,
      })
      .select("id")
      .single()
    if (error) return jsonError("Falha ao criar match", 500, error.message)
    reconciliationId = created.id
  }

  // Atualiza invoice + bank_transaction
  await supabase
    .from("invoices")
    .update({
      status: "matched",
      bank_transaction_id: input.bank_transaction_id,
      matched_at: new Date().toISOString(),
      matched_by: "manual",
    })
    .eq("id", input.invoice_id)
    .eq("tenant_id", ctx.tenantId)

  await supabase
    .from("bank_transactions")
    .update({
      invoice_id: input.invoice_id,
      matched_at: new Date().toISOString(),
      matched_by: "manual",
    })
    .eq("id", input.bank_transaction_id)
    .eq("tenant_id", ctx.tenantId)

  await log(supabase, {
    action:
      input.action === "confirm"
        ? "reconciliation.confirmed"
        : "reconciliation.created",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "reconciliation",
    resourceId: reconciliationId,
    metadata: {
      invoice_id: input.invoice_id,
      bank_transaction_id: input.bank_transaction_id,
    },
  })

  return Response.json({ data: { ok: true, reconciliation_id: reconciliationId } })
}
