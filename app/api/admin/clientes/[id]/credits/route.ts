import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createAdminClient, isSuperAdmin } from "@/lib/supabase/admin"
import { log } from "@/lib/utils/audit"

const creditsSchema = z.object({
  amount: z.number().int().min(-100_000).max(100_000),
  type: z.enum(["bonus", "refund", "monthly_reset"]).default("bonus"),
  description: z.string().trim().min(1).max(500),
})

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!isSuperAdmin(ctx.userId)) return jsonError("Forbidden", 403)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = creditsSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const supabase = createAdminClient()
  const { data: tenant } = await supabase
    .from("tenants")
    .select("credits_balance")
    .eq("id", params.id)
    .maybeSingle()
  if (!tenant) return jsonError("Not found", 404)

  const newBalance = (tenant.credits_balance ?? 0) + parsed.data.amount
  if (newBalance < 0) {
    return jsonError("Saldo não pode ficar negativo", 400)
  }

  const { error: updateError } = await supabase
    .from("tenants")
    .update({
      credits_balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
  if (updateError) {
    return jsonError("Could not update credits", 500, updateError.message)
  }

  await supabase.from("credit_transactions").insert({
    tenant_id: params.id,
    amount: parsed.data.amount,
    type: parsed.data.type,
    description: parsed.data.description,
    balance_after: newBalance,
  })

  await log(supabase, {
    action: "credits.bonus",
    tenantId: params.id,
    userId: ctx.userId,
    resourceType: "tenant",
    resourceId: params.id,
    metadata: {
      amount: parsed.data.amount,
      type: parsed.data.type,
      description: parsed.data.description,
    },
  })

  return Response.json({ data: { balance: newBalance } })
}
