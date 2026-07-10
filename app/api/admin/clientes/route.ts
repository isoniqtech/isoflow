import { z } from "zod"
import { NextResponse } from "next/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createAdminClient, isSuperAdmin } from "@/lib/supabase/admin"
import { log } from "@/lib/utils/audit"

const CREDITS_BY_PLAN: Record<string, number> = {
  starter: 500,
  business: 1500,
  pro: 5000,
  enterprise: 10000,
}

const createSchema = z.object({
  company_name: z.string().min(2),
  company_nif: z
    .string()
    .regex(/^\d{9}$/, "NIF deve ter 9 dígitos")
    .nullable()
    .optional(),
  company_email: z.string().email().nullable().optional(),
  company_phone: z.string().nullable().optional(),
  company_address: z.string().nullable().optional(),
  owner_name: z.string().min(2),
  owner_email: z.string().email(),
  plan: z.enum(["starter", "business", "pro", "enterprise"]),
  billing_cycle: z.enum(["monthly", "annual"]).default("monthly"),
  status: z.enum(["trial", "active"]).default("active"),
  initial_credits: z.number().int().min(0).optional(),
  internal_notes: z.string().nullable().optional(),
})

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ"
  const lower = "abcdefghjkmnpqrstuvwxyz"
  const digits = "23456789"
  const special = "!@#$%"
  const all = upper + lower + digits + special
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)]
  const required = [rand(upper), rand(lower), rand(digits), rand(special)]
  const rest = Array.from({ length: 8 }, () => rand(all))
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("")
}

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!isSuperAdmin(ctx.userId)) return jsonError("Forbidden", 403)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const d = parsed.data
  const supabase = createAdminClient()

  // 1. Verificar se email ja existe na tabela users
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", d.owner_email)
    .maybeSingle()

  if (existingUser) {
    return jsonError("Este email ja esta registado na plataforma. Usa outro email para o owner.", 400)
  }

  // 2. Criar tenant primeiro
  const baseCredits = CREDITS_BY_PLAN[d.plan] ?? 500
  const initialCredits =
    d.initial_credits !== undefined
      ? d.initial_credits
      : d.billing_cycle === "annual"
      ? baseCredits * 12
      : baseCredits

  const trialEndsAt =
    d.status === "trial"
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : null

  const nextBillingDate = (() => {
    const now = new Date()
    if (d.billing_cycle === "annual") {
      now.setFullYear(now.getFullYear() + 1)
    } else {
      now.setMonth(now.getMonth() + 1)
    }
    return now.toISOString().split("T")[0]
  })()

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      name: d.company_name,
      nif: d.company_nif ?? null,
      email: d.company_email ?? null,
      phone: d.company_phone ?? null,
      address: d.company_address ?? null,
      plan: d.plan,
      billing_cycle: d.billing_cycle,
      credits_balance: initialCredits,
      status: d.status,
      trial_ends_at: trialEndsAt,
      onboarding_completed: true,
      internal_notes: d.internal_notes ?? null,
      next_billing_date: nextBillingDate,
    })
    .select("id")
    .single()

  if (tenantError || !tenant) {
    return jsonError(
      "Falha ao criar empresa: " + (tenantError?.message ?? "desconhecido"),
      500,
    )
  }

  // 3. Criar utilizador no Supabase Auth
  // O trigger handle_new_user() cria o perfil automaticamente usando o tenant_id do metadata
  const tempPassword = generateTempPassword()
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: d.owner_email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: d.owner_name, tenant_id: tenant.id, role: "owner" },
  })

  if (authError || !authData.user) {
    await supabase.from("tenants").delete().eq("id", tenant.id)
    return jsonError(
      "Falha ao criar utilizador: " + (authError?.message ?? "desconhecido"),
      500,
    )
  }

  const userId = authData.user.id

  // 4. Audit log
  await log(supabase, {
    action: "tenant.created",
    tenantId: tenant.id,
    userId: ctx.userId,
    resourceType: "tenant",
    resourceId: tenant.id,
    metadata: {
      plan: d.plan,
      billing_cycle: d.billing_cycle,
      owner_email: d.owner_email,
      initial_credits: initialCredits,
    },
  })

  return NextResponse.json(
    {
      data: {
        tenant_id: tenant.id,
        owner_email: d.owner_email,
        temp_password: tempPassword,
      },
    },
    { status: 201 },
  )
}
