import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AdminClientsFilters } from "./clients-filters"
import { listAdminClients } from "@/lib/queries/admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type { TenantPlan, TenantStatus } from "@/types"

const STATUS_STYLES: Record<TenantStatus, { label: string; className: string }> = {
  trial: {
    label: "Trial",
    className:
      "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  },
  active: {
    label: "Ativo",
    className:
      "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  },
  suspended: {
    label: "Suspenso",
    className:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  },
  cancelled: {
    label: "Cancelado",
    className:
      "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
  },
}

const VALID_STATUS: Array<TenantStatus | "all"> = [
  "all",
  "trial",
  "active",
  "suspended",
  "cancelled",
]
const VALID_PLAN: Array<TenantPlan | "all"> = [
  "all",
  "starter",
  "business",
  "pro",
  "enterprise",
]

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: { status?: string; plan?: string; credits?: string; q?: string }
}) {
  const status = (VALID_STATUS as string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as TenantStatus | "all")
    : "all"
  const plan = (VALID_PLAN as string[]).includes(searchParams.plan ?? "")
    ? (searchParams.plan as TenantPlan | "all")
    : "all"
  const credits =
    searchParams.credits === "zero" || searchParams.credits === "low"
      ? searchParams.credits
      : "all"
  const q = searchParams.q ?? ""

  const superAdminUserId = process.env.SUPER_ADMIN_USER_ID
  const [clients, superAdminProfile] = await Promise.all([
    listAdminClients({
      status,
      plan,
      credits: credits === "all" ? undefined : credits,
      q: q || undefined,
    }),
    superAdminUserId
      ? createAdminClient()
          .from("users")
          .select("tenant_id")
          .eq("id", superAdminUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const isoniqTenantId = superAdminProfile.data?.tenant_id ?? null

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            {clients.length} {clients.length === 1 ? "tenant" : "tenants"}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/clientes/novo">
            <Plus className="h-4 w-4 mr-1.5" />
            Novo cliente
          </Link>
        </Button>
      </div>

      <AdminClientsFilters
        status={status}
        plan={plan}
        credits={credits}
        q={q}
      />

      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">NIF</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead className="text-right">Créditos</TableHead>
              <TableHead className="text-right">Tickets</TableHead>
              <TableHead className="hidden lg:table-cell">Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-12">
                  Sem clientes para os filtros escolhidos.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c) => {
                const s = STATUS_STYLES[c.status]
                return (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/admin/clientes/${c.id}`} className="block">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{c.name}</p>
                          {c.id === isoniqTenantId && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 shrink-0">
                              ISONIQ
                            </Badge>
                          )}
                        </div>
                        {c.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {c.email}
                          </p>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      <Link href={`/admin/clientes/${c.id}`} className="block">
                        {c.nif ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/clientes/${c.id}`} className="block">
                        <Badge variant="secondary" className="capitalize">
                          {c.plan}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/clientes/${c.id}`} className="block">
                        <Badge variant="outline" className={s.className}>
                          {s.label}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      <Link href={`/admin/clientes/${c.id}`} className="block">
                        {c.mrr > 0 ? formatCurrency(c.mrr) : "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className={cn(
                          "block",
                          c.credits_balance === 0 && "text-destructive font-medium",
                        )}
                      >
                        {c.credits_balance.toLocaleString("pt-PT")}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      <Link href={`/admin/clientes/${c.id}`} className="block">
                        {c.open_tickets > 0 ? (
                          <Badge variant="outline">{c.open_tickets}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      <Link href={`/admin/clientes/${c.id}`} className="block">
                        {formatDate(c.created_at)}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
