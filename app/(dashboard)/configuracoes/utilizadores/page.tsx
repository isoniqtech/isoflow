import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, Mail, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types"

const ROLE_STYLES: Record<UserRole, { label: string; className: string }> = {
  owner: {
    label: "Owner",
    className:
      "bg-purple-100 text-purple-900 border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-900/40",
  },
  admin: {
    label: "Admin",
    className:
      "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  },
  accountant: {
    label: "Contabilista",
    className:
      "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  },
  member: {
    label: "Membro",
    className:
      "bg-slate-100 text-slate-900 border-slate-200 dark:bg-slate-900/20 dark:text-slate-200 dark:border-slate-900/40",
  },
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s.charAt(0))
    .join("")
    .toUpperCase()
}

export default async function UtilizadoresPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "utilizadores", "view_all")) {
    redirect("/configuracoes")
  }

  const supabase = createClient()
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, is_active, last_login_at, created_at")
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: true })

  const list = users ?? []

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/configuracoes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Configurações
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Utilizadores
            </h1>
            <p className="text-muted-foreground text-sm">
              {list.length}{" "}
              {list.length === 1 ? "utilizador" : "utilizadores"} na empresa
            </p>
          </div>
          <Button disabled title="Em breve">
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar utilizador
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">
                Último acesso
              </TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((u) => {
              const role = ROLE_STYLES[(u.role ?? "member") as UserRole]
              const isYou = u.id === session.user.id
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {u.name}
                          {isYou && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (tu)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground sm:hidden truncate">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">
                    <a
                      href={`mailto:${u.email}`}
                      className="inline-flex items-center gap-1 hover:underline text-muted-foreground"
                    >
                      <Mail className="h-3 w-3" />
                      {u.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={role.className}>
                      {role.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {u.last_login_at ? formatDate(u.last_login_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs",
                        u.is_active
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          u.is_active ? "bg-emerald-500" : "bg-muted-foreground",
                        )}
                      />
                      {u.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        O fluxo de convite por email está em desenvolvimento — vai precisar do
        Resend configurado. Por agora, a lista mostra apenas membros existentes.
      </div>
    </div>
  )
}
