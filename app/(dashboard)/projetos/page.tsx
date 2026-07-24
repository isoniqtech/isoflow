import Link from "next/link"
import { redirect } from "next/navigation"
import { Download, FolderPlus, Menu, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProjectCard } from "@/components/projetos/project-card"
import { ProjectRow } from "@/components/projetos/project-row"
import { ViewToggle, type VistaProjetos } from "@/components/projetos/view-toggle"
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
  searchParams: { status?: string; type?: string; vista?: string }
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

  const vista: VistaProjetos = searchParams.vista === "lista" ? "lista" : "grelha"
  // Preservar os filtros ao trocar de vista
  const hrefVista = (v: VistaProjetos) =>
    `/projetos?${new URLSearchParams({
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(v === "lista" ? { vista: "lista" } : {}),
    }).toString()}`

  const canCreate = hasPermission(session.role, "projetos", "create")
  const canExport = hasPermission(session.role, "relatorios", "view_all") && projects.length > 0
  const exportUrl = `/api/projetos/export?${new URLSearchParams({
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
  }).toString()}`

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-display font-semibold tracking-tight">Projetos</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectsFilters status={statusFilter} type={typeFilter} />
          <ViewToggle vista={vista} hrefFor={hrefVista} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canCreate && (
            <Button className="h-9" asChild>
              <Link href="/projetos/novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo projeto
              </Link>
            </Button>
          )}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 bg-card border-border/60 shadow-sm" aria-label="Mais ações">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={exportUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState canCreate={canCreate} />
      ) : (
        <>
          {vista === "grelha" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="border border-border/60 rounded-lg p-12 flex flex-col items-center text-center bg-card shadow-[var(--shadow-card,none)]">
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
