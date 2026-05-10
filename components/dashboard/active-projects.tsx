import Link from "next/link"
import { FolderKanban } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BudgetProgress } from "@/components/projetos/budget-progress"
import { cn } from "@/lib/utils"
import type { RecentProject } from "@/lib/queries/dashboard"

export function ActiveProjects({ projects }: { projects: RecentProject[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Projetos ativos</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projetos">Ver todos</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {projects.map((project) => (
              <ProjectItem key={project.id} project={project} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ProjectItem({ project }: { project: RecentProject }) {
  return (
    <li>
      <Link
        href={`/projetos/${project.id}`}
        className="block rounded-md border p-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className={cn("h-2 w-2 rounded-full shrink-0")}
            style={{ backgroundColor: project.color }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{project.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {project.type} · {project.invoice_count} faturas
            </p>
          </div>
        </div>
        <BudgetProgress
          spent={project.total_spent}
          budget={project.budget}
          threshold={project.budget_alert_threshold}
        />
      </Link>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <FolderKanban className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground mb-3">
        Ainda não tens projetos ativos.
      </p>
      <Button size="sm" asChild>
        <Link href="/projetos/novo">Criar projeto</Link>
      </Button>
    </div>
  )
}
