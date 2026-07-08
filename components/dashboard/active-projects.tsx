import Link from "next/link"
import { FolderKanban } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/portugal"
import type { RecentProject } from "@/lib/queries/dashboard"

export function ActiveProjects({ projects }: { projects: RecentProject[] }) {
  return (
    <Card className="shadow-[var(--shadow-card,none)] border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium font-display">Projetos ativos</CardTitle>
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
  const hasBudget = project.budget !== null && project.budget > 0
  const pct = hasBudget ? Math.min(100, Math.round((project.total_spent / project.budget!) * 100)) : null
  const isOver = pct !== null && pct >= 100
  const isWarn = pct !== null && !isOver && pct >= project.budget_alert_threshold

  return (
    <li>
      <Link
        href={`/projetos/${project.id}`}
        className="block rounded-md border p-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <p className="text-sm font-medium truncate flex-1">{project.name}</p>
          <span className="text-xs text-muted-foreground shrink-0">{project.invoice_count} fat.</span>
        </div>

        {hasBudget ? (
          <>
            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: isOver
                    ? "linear-gradient(90deg, #F87171, #EF4444)"
                    : isWarn
                    ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
                    : "linear-gradient(90deg, #4E7217, #3DAEAF)",
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div>
                <p className="text-muted-foreground">Gasto</p>
                <p className="font-medium tabular-nums">{formatCurrency(project.total_spent)}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">Restante</p>
                <p className={cn("font-medium tabular-nums", isOver && "text-destructive")}>
                  {formatCurrency(project.remaining!)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Orçamento</p>
                <p className="font-medium tabular-nums">{formatCurrency(project.budget!)}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Gasto: <span className="font-medium text-foreground">{formatCurrency(project.total_spent)}</span>
            {" · "}sem orçamento definido
          </p>
        )}
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
