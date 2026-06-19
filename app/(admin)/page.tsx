import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/portugal"
import type { TenantPlan, TenantStatus } from "@/types"

const PLAN_LABELS: Record<TenantPlan, string> = {
  starter: "Starter",
  business: "Business",
  pro: "Pro",
  enterprise: "Enterprise",
}

const STATUS_CLASSES: Record<TenantStatus, string> = {
  trial: "bg-amber-100 text-amber-800 border-amber-200",
  active: "bg-green-100 text-green-800 border-green-200",
  suspended: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
}

const STATUS_LABELS: Record<TenantStatus, string> = {
  trial: "Trial",
  active: "Ativo",
  suspended: "Suspenso",
  cancelled: "Cancelado",
}

async function getTenants() {
  const admin = createAdminClient()

  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, nif, email, plan, status, credits_balance, created_at")
    .order("created_at", { ascending: false })

  if (!tenants?.length) return []

  const ids = tenants.map((t) => t.id)
  const [usersRes, invoicesRes] = await Promise.all([
    admin.from("users").select("tenant_id").in("tenant_id", ids),
    admin.from("invoices").select("tenant_id").in("tenant_id", ids),
  ])

  const userCounts: Record<string, number> = {}
  const invoiceCounts: Record<string, number> = {}

  for (const u of usersRes.data ?? []) userCounts[u.tenant_id] = (userCounts[u.tenant_id] ?? 0) + 1
  for (const i of invoicesRes.data ?? []) invoiceCounts[i.tenant_id] = (invoiceCounts[i.tenant_id] ?? 0) + 1

  return tenants.map((t) => ({
    ...t,
    user_count: userCounts[t.id] ?? 0,
    invoice_count: invoiceCounts[t.id] ?? 0,
  }))
}

export default async function AdminPage() {
  const tenants = await getTenants()

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tenants.length} tenants registados</p>
        </div>
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">NIF</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plano</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Creditos</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Users</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Faturas</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Criado</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/clientes/${t.id}`}
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {t.name}
                  </Link>
                  {t.email && (
                    <p className="text-xs text-muted-foreground">{t.email}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{t.nif ?? "-"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">
                    {PLAN_LABELS[t.plan as TenantPlan] ?? t.plan}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CLASSES[t.status as TenantStatus] ?? ""}`}
                  >
                    {STATUS_LABELS[t.status as TenantStatus] ?? t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.credits_balance ?? 0}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{t.user_count}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.invoice_count}</td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                  {t.created_at ? new Date(t.created_at).toLocaleDateString("pt-PT") : "-"}
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum tenant registado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
