import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AlertTriangle, ChevronLeft, FileText, Mail, MessageCircle, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/faturas/status-badge"
import { InvoiceActions } from "@/components/faturas/invoice-actions"
import { getCurrentSession } from "@/lib/queries/current-session"
import { getInvoiceDetail } from "@/lib/queries/invoice-detail"
import { hasPermission } from "@/lib/utils/permissions"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { InvoiceSource } from "@/types"

const SOURCE_ICONS: Record<InvoiceSource, typeof FileText> = {
  whatsapp: MessageCircle,
  email: Mail,
  manual: Upload,
  api: FileText,
  erp: FileText,
}

const SOURCE_LABELS: Record<InvoiceSource, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  manual: "Upload manual",
  api: "API",
  erp: "ERP",
}

const CATEGORY_LABELS: Record<string, string> = {
  transporte: "Transporte",
  alimentacao: "Alimentação",
  tecnologia: "Tecnologia",
  servicos: "Serviços",
  material: "Material",
  combustivel: "Combustível",
  comunicacoes: "Comunicações",
  alojamento: "Alojamento",
  formacao: "Formação",
  outro: "Outro",
}

export default async function FaturaDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")

  const invoice = await getInvoiceDetail(params.id, session.tenant.id, {
    restrictToCreatedBy:
      session.role === "member" ? session.user.id : undefined,
  })
  if (!invoice) notFound()

  const SourceIcon = SOURCE_ICONS[invoice.source] ?? FileText
  const canEdit = hasPermission(session.role, "faturas", "edit")
  const canDelete = hasPermission(session.role, "faturas", "delete")

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/faturas"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar a faturas
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight truncate">
                {invoice.supplier_name ?? "Fornecedor desconhecido"}
              </h1>
              <StatusBadge status={invoice.status} />
              {invoice.needs_review && (
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Necessita revisão
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {invoice.invoice_number && (
                <span className="font-mono">{invoice.invoice_number}</span>
              )}
              {invoice.invoice_date && (
                <span>{formatDate(invoice.invoice_date)}</span>
              )}
              <span className="inline-flex items-center gap-1">
                <SourceIcon className="h-3.5 w-3.5" />
                {SOURCE_LABELS[invoice.source]}
              </span>
            </div>
          </div>

          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Valores</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-4">
                <dt className="text-sm text-muted-foreground">Subtotal</dt>
                <dd className="text-sm tabular-nums text-right">
                  {invoice.subtotal !== null
                    ? formatCurrency(invoice.subtotal)
                    : "—"}
                </dd>
                <dt className="text-sm text-muted-foreground">
                  IVA{invoice.vat_rate !== null ? ` (${invoice.vat_rate}%)` : ""}
                </dt>
                <dd className="text-sm tabular-nums text-right">
                  {invoice.vat_amount !== null
                    ? formatCurrency(invoice.vat_amount)
                    : "—"}
                </dd>
                <dt className="text-sm font-semibold border-t pt-3">Total</dt>
                <dd className="text-sm font-semibold tabular-nums text-right border-t pt-3">
                  {invoice.total !== null
                    ? formatCurrency(invoice.total)
                    : "—"}
                </dd>
                {invoice.due_date && (
                  <>
                    <dt className="text-sm text-muted-foreground">
                      Vencimento
                    </dt>
                    <dd className="text-sm text-right">
                      {formatDate(invoice.due_date)}
                    </dd>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          {(invoice.description ||
            invoice.category ||
            invoice.notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Detalhes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoice.category && (
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Categoria</span>
                    <Badge variant="secondary">
                      {CATEGORY_LABELS[invoice.category] ?? invoice.category}
                    </Badge>
                  </div>
                )}
                {invoice.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm whitespace-pre-line">
                      {invoice.description}
                    </p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notas internas</p>
                    <p className="text-sm whitespace-pre-line">
                      {invoice.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Fornecedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">
                {invoice.supplier_name ?? "Sem nome"}
              </p>
              {invoice.supplier_nif && (
                <p className="text-muted-foreground font-mono text-xs">
                  NIF: {invoice.supplier_nif}
                </p>
              )}
              {invoice.supplier_email && (
                <p className="text-muted-foreground text-xs break-all">
                  {invoice.supplier_email}
                </p>
              )}
              {invoice.supplier_address && (
                <p className="text-muted-foreground text-xs whitespace-pre-line">
                  {invoice.supplier_address}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.project ? (
                <Link
                  href={`/projetos/${invoice.project.id}`}
                  className="inline-flex items-center gap-2 text-sm hover:underline"
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: invoice.project.color }}
                  />
                  {invoice.project.name}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Não atribuída a nenhum projeto
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                Criada em <strong className="text-foreground">{formatDate(invoice.created_at)}</strong>
              </p>
              {invoice.updated_at !== invoice.created_at && (
                <p>
                  Atualizada em{" "}
                  <strong className="text-foreground">
                    {formatDate(invoice.updated_at)}
                  </strong>
                </p>
              )}
              {invoice.matched_at && (
                <p>
                  Conciliada em{" "}
                  <strong className="text-foreground">
                    {formatDate(invoice.matched_at)}
                  </strong>{" "}
                  ({invoice.matched_by})
                </p>
              )}
              {invoice.erp_synced && invoice.erp_synced_at && (
                <p>
                  Enviada para ERP em{" "}
                  <strong className="text-foreground">
                    {formatDate(invoice.erp_synced_at)}
                  </strong>
                </p>
              )}
              {invoice.at_communicated && invoice.at_communicated_at && (
                <p>
                  Comunicada à AT em{" "}
                  <strong className="text-foreground">
                    {formatDate(invoice.at_communicated_at)}
                  </strong>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
