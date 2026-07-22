import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { BudgetProgress } from "@/components/projetos/budget-progress"
import { cn } from "@/lib/utils"
import type { ProjectListItem } from "@/lib/queries/projects"
import type { ProjectStatus, ProjectType } from "@/types"

/**
 * Projeto em linha (vista de lista).
 *
 * Mesma informação do ProjectCard, disposta na horizontal para caber mais
 * projetos no ecrã. Usa a mesma linguagem visual (.surface-card), para as duas
 * vistas serem coerentes entre si e com o resto da app.
 */

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

export function ProjectRow({ project }: { project: ProjectListItem }) {
  const status = STATUS_STYLES[project.status]

  return (
    <Link href={`/projetos/${project.id}`} className="block">
      <div className="surface-card surface-card-hover flex flex-col gap-3 p-4 md:flex-row md:items-center">
        {/* Nome, código e cliente */}
        <div className="min-w-0 flex-1 md:max-w-xs">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <h3 className="truncate font-display font-semibold">{project.name}</h3>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {project.code && <span className="font-mono">{project.code}</span>}
            {project.code && project.client_name && " · "}
            {project.client_name}
          </p>
        </div>

        {/* Tipo e nº de faturas */}
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{TYPE_LABELS[project.type]}</Badge>
          <span>{project.invoice_count} faturas</span>
        </div>

        {/* Orçamento: termina sempre no mesmo ponto, porque a coluna do estado
            tem largura fixa (senao "Concluído" empurrava a barra mais para a
            esquerda do que "Ativo" e as linhas ficavam desalinhadas) */}
        <div className="min-w-0 flex-1 md:pr-2">
          <BudgetProgress
            spent={project.total_spent}
            budget={project.budget}
            threshold={project.budget_alert_threshold}
          />
        </div>

        {/* Estado (as datas ficam so' na vista em grelha e no detalhe: em
            lista enchiam demasiado a linha) */}
        <div className="flex shrink-0 items-center md:w-28 md:justify-end">
          <Badge variant="outline" className={cn("shrink-0", status.className)}>
            {status.label}
          </Badge>
        </div>
      </div>
    </Link>
  )
}
