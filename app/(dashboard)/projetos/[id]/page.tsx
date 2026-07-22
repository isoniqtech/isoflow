import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  CheckCircle2,
  ChevronLeft,
  Coins,
  Euro,
  FileText,
  TrendingDown,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { BudgetProgress } from "@/components/projetos/budget-progress"
import { ProjectMonthlyChart } from "@/components/projetos/project-monthly-chart"
import { ProjectCategoryChart } from "@/components/projetos/project-category-chart"
import { ProjectInvoices } from "@/components/projetos/project-invoices"
import { ProjectActions } from "@/components/projetos/project-actions"
import { ProjectInvestorBlock } from "@/components/investidores/project-investor-block"
import { ProjectDocumentsTab } from "@/components/projetos/project-documents-tab"
import { ProjectPlanTab } from "@/components/projetos/project-plan-tab"
import { getCurrentSession } from "@/lib/queries/current-session"
import { getProjectDetail } from "@/lib/queries/project-detail"
import { listInvestidores } from "@/lib/queries/investidores"
import { hasPermission } from "@/lib/utils/permissions"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
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

const VALID_TABS = ["dashboard", "documentacao", "planejamento"] as const
type ProjectTab = (typeof VALID_TABS)[number]

const TAB_LABELS: Record<ProjectTab, string> = {
  dashboard: "Dashboard",
  documentacao: "Documentação",
  planejamento: "Planejamento",
}

export default async function ProjetoDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")

  const vatRegime = ((session.tenant as Record<string, unknown>).vat_regime as import("@/types").VatRegime) ?? "normal"
  const data = await getProjectDetail(params.id, session.tenant.id, vatRegime)
  if (!data) notFound()

  // Investidor: so' pode ver os projetos a que esta' associado. A listagem ja'
  // filtrava (lib/queries/projects.ts), mas o acesso direto por URL nao tinha
  // guarda. Mesmo padrao usado no detalhe da fatura.
  if (session.role === "investidor") {
    const { getInvestidorProjectIds } = await import("@/lib/queries/investidores")
    const allowed = await getInvestidorProjectIds(session.user.id)
    if (!allowed.includes(params.id)) redirect("/projetos")
  }

  const { project, kpis, monthly, by_category, invoices } = data
  const status = STATUS_STYLES[project.status]
  const canEdit = hasPermission(session.role, "projetos", "edit")
  const canDelete = hasPermission(session.role, "projetos", "delete")
  const canExportReport = hasPermission(session.role, "relatorios", "view_all")
  const canViewInvestidores = hasPermission(session.role, "investidores", "view_all")
  const canEditInvestidores = hasPermission(session.role, "investidores", "edit")

  const activeTab: ProjectTab = (VALID_TABS as readonly string[]).includes(searchParams.tab ?? "")
    ? (searchParams.tab as ProjectTab)
    : "dashboard"

  let linkedInvestidores: Array<{
    investidor_id: string
    nome: string
    email: string
    percentagem: number
    valor_estimado: number | null
  }> = []
  let allInvestidores: Array<{ id: string; nome: string; email: string; capital_disponivel: number }> = []

  if (canViewInvestidores) {
    const { createClient } = await import("@/lib/supabase/server")
    const sb = createClient()
    const { data: piRows, error: piErr } = await sb
      .from("projeto_investidores")
      .select("investidor_id, percentagem, valor_alocado, investidores(id, nome, email)")
      .eq("projeto_id", params.id)
    console.log("[projetos/page] piRows:", JSON.stringify(piRows), "piErr:", piErr?.message)

    const budget = project.budget !== null ? Number(project.budget) : null
    linkedInvestidores = (piRows ?? []).map((r) => {
      const rawInv = r.investidores
      const inv = (Array.isArray(rawInv) ? rawInv[0] : rawInv) as { id: string; nome: string; email: string } | null
      const pct = Number(r.percentagem)
      const valorAlocado = r.valor_alocado !== null && r.valor_alocado !== undefined
        ? Number(r.valor_alocado)
        : (budget !== null ? (budget * pct) / 100 : null)
      return {
        investidor_id: r.investidor_id,
        nome: inv?.nome ?? "",
        email: inv?.email ?? "",
        percentagem: pct,
        valor_estimado: valorAlocado,
      }
    })
    const allFull = await listInvestidores(session.tenant.id)
    allInvestidores = allFull.map((i) => ({ id: i.id, nome: i.nome, email: i.email, capital_disponivel: i.capital_disponivel }))
  }

  const overThreshold =
    kpis.pct_used !== null && kpis.pct_used >= project.budget_alert_threshold
  const overBudget = kpis.pct_used !== null && kpis.pct_used >= 100

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <Link
          href="/projetos"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar a projetos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <h1 className="text-2xl font-display font-semibold tracking-tight truncate">
                {project.name}
              </h1>
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
              <Badge variant="secondary">{TYPE_LABELS[project.type]}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {project.code && (
                <span className="font-mono">{project.code}</span>
              )}
              {project.client_name && <span>{project.client_name}</span>}
              {project.location && <span>📍 {project.location}</span>}
              {(project.start_date || project.end_date) && (
                <span>
                  {project.start_date ? formatDate(project.start_date) : "—"} →{" "}
                  {project.end_date ? formatDate(project.end_date) : "Em curso"}
                </span>
              )}
            </div>
          </div>

          <ProjectActions
            projectId={project.id}
            projectName={project.name}
            canEdit={canEdit}
            canDelete={false}
            canExportReport={canExportReport}
          />
        </div>

        {project.description && (
          <p className="mt-3 text-sm text-muted-foreground max-w-3xl whitespace-pre-line">
            {project.description}
          </p>
        )}
      </div>

      {/* Tabs: padrao searchParams usado na app (ver faturas/page.tsx) */}
      <div className="border-b">
        <nav className="flex gap-6 -mb-px">
          {VALID_TABS.map((tab) => (
            <Link
              key={tab}
              href={`/projetos/${project.id}?tab=${tab}`}
              className={cn(
                "border-b-2 pb-2 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground",
              )}
            >
              {TAB_LABELS[tab]}
            </Link>
          ))}
        </nav>
      </div>

      {/* ---------- Dashboard: conteudo original, movido sem alteracoes ---------- */}
      {activeTab === "dashboard" && (
        <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total gasto"
          value={formatCurrency(kpis.total_spent)}
          icon={Euro}
          hint={`${kpis.invoice_count} faturas`}
        />
        <KpiCard
          label="Orçamento"
          value={
            project.budget !== null
              ? formatCurrency(project.budget)
              : "Sem orçamento"
          }
          icon={Coins}
          hint={
            project.budget !== null
              ? `Threshold ${project.budget_alert_threshold}%`
              : "—"
          }
        />
        <KpiCard
          label="Restante"
          value={
            kpis.budget_remaining !== null
              ? formatCurrency(kpis.budget_remaining)
              : "—"
          }
          icon={TrendingDown}
          hint={
            kpis.pct_used !== null
              ? `${Math.round(kpis.pct_used)}% usado`
              : "Sem orçamento"
          }
          className={cn(
            overBudget && "border-destructive",
            overThreshold && !overBudget && "border-amber-500",
          )}
        />
        <KpiCard
          label="Faturas"
          value={kpis.invoice_count.toString()}
          icon={FileText}
          hint="Não rejeitadas"
        />
      </div>

      {project.budget !== null && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso do orçamento</span>
            {overBudget && (
              <Badge variant="outline" className="bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40">
                <CheckCircle2 className="h-3 w-3 mr-1 hidden" />
                Orçamento ultrapassado
              </Badge>
            )}
            {overThreshold && !overBudget && (
              <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40">
                Acima do limite de aviso
              </Badge>
            )}
          </div>
          <BudgetProgress
            spent={kpis.total_spent}
            budget={project.budget}
            threshold={project.budget_alert_threshold}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ProjectMonthlyChart data={monthly} />
        </div>
        <ProjectCategoryChart data={by_category} />
      </div>

      {canViewInvestidores && (
        <ProjectInvestorBlock
          projectId={project.id}
          budget={project.budget}
          linked={linkedInvestidores}
          available={allInvestidores}
          canEdit={canEditInvestidores}
        />
      )}

      <ProjectInvoices invoices={invoices} projectId={project.id} />
        </>
      )}

      {/* ---------- Documentacao ---------- */}
      {activeTab === "documentacao" && (
        <ProjectDocumentsTab
          projectId={project.id}
          canEdit={canEdit}
          isInvestidor={session.role === "investidor"}
        />
      )}

      {/* ---------- Planejamento ---------- */}
      {activeTab === "planejamento" && (
        <ProjectPlanTab
          projectId={project.id}
          canEdit={canEdit}
          isInvestidor={session.role === "investidor"}
        />
      )}
    </div>
  )
}
