import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentSession } from "@/lib/queries/current-session"

export type BankAccountConfig = {
  id: string
  bank_name: string
  iban: string
  account_type: string
  label: string
}

// POST — upsert lista de contas bancárias manuais
export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const accounts: BankAccountConfig[] = body.accounts ?? []

  const supabase = createClient()

  const { error } = await supabase
    .from("tenant_integrations")
    .upsert(
      {
        tenant_id: session.tenant.id,
        type: "banking",
        provider: "manual",
        is_active: accounts.length > 0,
        config: { accounts },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,type,provider" },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// GET — devolve contas configuradas
export async function GET() {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient()
  const { data } = await supabase
    .from("tenant_integrations")
    .select("config, is_active")
    .eq("tenant_id", session.tenant.id)
    .eq("type", "banking")
    .eq("provider", "manual")
    .maybeSingle()

  const accounts = (data?.config as { accounts?: BankAccountConfig[] } | null)?.accounts ?? []
  return NextResponse.json({ accounts, is_active: data?.is_active ?? false })
}
