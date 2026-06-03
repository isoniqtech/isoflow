import Link from "next/link"
import { redirect } from "next/navigation"
import { Download, FolderPlus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/projetos/project-card"
import { ProjectsFilters } from "./projects-filters"
import { getCurrentSession } from "@/lib/queries/current-session"
import { listProjects } from "@/lib/queries/projects"
import { hasPermission } from "@/lib/utils/permissions"
import type { ProjectStatus, ProjectType } from "@/types"

const VALID_STATUS: Array<ProjectStatus | "all"> = [
  "all",
  "active",
  "completed",
  "paused",
  "cancelled",
]
const VALID_TYPE: Array<ProjectType | "all"> = [
  "all",
  "obra",
  "projeto",
  "departamento",
  "cliente",
  "outro",
]

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")

  const statusFilter =
    (VALID_STATUS as string[]).includes(searchParams.status ?? "")
      ? (searchParams.status as ProjectStatus | "all")
      : "all"
  const typeFilter =
    (VALID_TYPE as string[]).includes(searchParams.type ?? "")
      ? (searchParams.type as ProjectType | "all")
      : "all"

  const vatRegime = ((session.tenant as Record<string, unknown>).vat_regime as import("@/types").VatRegime) ?? "normal"

  const projects = await listProjects(session.tenant.id, {
    role: session.role,
    userId: session.user.id,
    filter: { status: statusFilter, type: typeFilter },
    vatRegime,
  })

  const canCreate = hasPermission(session.role, "projetos", "create")

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-muted-foreground text-sm">
            {projects.length}{" "}
            {projects.length === 1 ? "projeto" : "projetos"}
            {statusFilter !== "all" || typeFilter !== "all" ? " (filtrados)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission(session.role, "relatorios", "view_all") &&
            projects.length > 0 && (
              <Button variant="outline" asChild>
                <a
                  href={`/api/projetos/export?${new URLSearchParams({
                    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
                    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
                  }).toString()}`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </a>
              </Button>
            )}
          {canCreate && (
            <Button asChild>
              <Link href="/projetos/novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo projeto
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ProjectsFilters status={statusFilter} type={typeFilter} />

      {projects.length === 0 ? (
        <EmptyState canCreate={canCreate} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="border rounded-lg p-12 flex flex-col items-center text-center bg-background">
      <FolderPlus className="h-10 w-10 text-muted-foreground mb-3" />
      <h2 className="font-semibold mb-1">Sem projetos por aqui</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        Cria projetos para organizares as faturas por obra, departamento ou
        cliente. Podes definir orçamentos e alertas.
      </p>
      {canCreate && (
        <Button asChild>
          <Link href="/projetos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Criar primeiro projeto
          </Link>
        </Button>
      )}
    </div>
  )
}
