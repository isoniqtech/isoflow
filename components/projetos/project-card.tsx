import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BudgetProgress } from "@/components/projetos/budget-progress"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/portugal"
import type { ProjectListItem } from "@/lib/queries/projects"
import type { ProjectStatus, ProjectType } from "@/types"

const TYPE_LABELS: Record<ProjectType, string> = {
  obra: "Obra",
  projeto: "Projeto",
  departamento: "Departamento",
  cliente: "Cliente",
  outro: "Outro",
}

const STATUS_STYLES: Record<ProjectStatus, { label: string; className: string }> = {
  active: {
    label: "Ativo",
    className:
      "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  },
  completed: {
    label: "Concluído",
    className:
      "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  },
  paused: {
    label: "Pausado",
    className:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  },
  cancelled: {
    label: "Cancelado",
    className:
      "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
  },
}

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const status = STATUS_STYLES[project.status]
  return (
    <Link href={`/projetos/${project.id}`} className="group">
      <Card className="surface-card surface-card-hover h-full border-0">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <h3 className="font-display font-semibold truncate">{project.name}</h3>
              </div>
              {project.code && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {project.code}
                </p>
              )}
            </div>
            <Badge variant="outline" className={cn("shrink-0", status.className)}>
              {status.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{TYPE_LABELS[project.type]}</Badge>
            <span>·</span>
            <span>{project.invoice_count} faturas</span>
            {project.client_name && (
              <>
                <span>·</span>
                <span className="truncate">{project.client_name}</span>
              </>
            )}
          </div>

          <BudgetProgress
            spent={project.total_spent}
            budget={project.budget}
            threshold={project.budget_alert_threshold}
          />

          {(project.start_date || project.end_date) && (
            <p className="text-xs text-muted-foreground">
              {project.start_date ? formatDate(project.start_date) : "—"}
              {" → "}
              {project.end_date ? formatDate(project.end_date) : "Em curso"}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
