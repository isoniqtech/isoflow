"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Users, FileText, CreditCard, Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CreateUserForm } from "@/components/admin/create-user-form"

type Tenant = {
  id: string
  name: string
  nif: string | null
  email: string | null
  plan: string
  status: string
  credits_balance: number
  created_at: string
}

type TenantUser = {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Contabilista",
  member: "Membro",
}

const ROLE_CLASSES: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  accountant: "bg-green-100 text-green-800 border-green-200",
  member: "bg-gray-100 text-gray-700 border-gray-200",
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [tenantsRes, usersRes] = await Promise.all([
      fetch("/api/admin/tenants"),
      fetch(`/api/admin/tenants/${params.id}/users`),
    ])

    if (tenantsRes.ok) {
      const all: Tenant[] = await tenantsRes.json()
      setTenant(all.find((t) => t.id === params.id) ?? null)
    }
    if (usersRes.ok) {
      setUsers(await usersRes.json())
    }
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-muted-foreground">Tenant nao encontrado.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">Clientes</Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground font-medium">{tenant.name}</span>
      </nav>

      {/* Tenant info */}
      <div className="rounded-lg border bg-background p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{tenant.name}</h1>
              {tenant.email && <p className="text-sm text-muted-foreground">{tenant.email}</p>}
            </div>
          </div>
          <Badge variant="outline">{tenant.plan}</Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t">
          <Stat icon={<FileText className="h-4 w-4" />} label="NIF" value={tenant.nif ?? "-"} />
          <Stat icon={<CreditCard className="h-4 w-4" />} label="Creditos" value={String(tenant.credits_balance)} />
          <Stat icon={<Users className="h-4 w-4" />} label="Utilizadores" value={String(users.length)} />
          <Stat
            icon={<FileText className="h-4 w-4" />}
            label="Registado em"
            value={new Date(tenant.created_at).toLocaleDateString("pt-PT")}
          />
        </div>
      </div>

      {/* Users */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h2 className="font-medium text-sm">Utilizadores ({users.length})</h2>
          <CreateUserForm tenantId={tenant.id} onCreated={fetchData} />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Ultimo login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_CLASSES[u.role] ?? ""}`}
                  >
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${u.is_active ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}
                  >
                    {u.is_active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                  {u.last_login_at
                    ? new Date(u.last_login_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })
                    : "Nunca"}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum utilizador neste tenant
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm">{value}</p>
      </div>
    </div>
  )
}
