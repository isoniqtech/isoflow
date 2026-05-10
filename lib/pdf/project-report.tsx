import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import type { ProjectDetailData } from "@/lib/queries/project-detail"

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

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  processing: "A processar",
  matched: "Conciliada",
  paid: "Paga",
  rejected: "Rejeitada",
  duplicate: "Duplicada",
}

function formatCurrencyPdf(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function formatDatePdf(input: string | null | undefined): string {
  if (!input) return "—"
  try {
    return new Intl.DateTimeFormat("pt-PT").format(new Date(input))
  } catch {
    return "—"
  }
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#0a0a0a",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 12,
    marginBottom: 16,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandSquare: {
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLetter: {
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    fontSize: 14,
  },
  brandText: {
    flexDirection: "column",
  },
  brandName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  brandTagline: {
    fontSize: 8,
    color: "#737373",
  },
  meta: {
    fontSize: 8,
    color: "#737373",
    textAlign: "right",
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#525252",
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: "#f4f4f5",
    color: "#0a0a0a",
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#737373",
    marginBottom: 8,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 8,
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  kpiValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    marginTop: 2,
  },
  kpiHint: {
    fontSize: 7,
    color: "#a3a3a3",
    marginTop: 2,
  },
  table: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 4,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  trLast: {
    flexDirection: "row",
  },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    padding: 6,
  },
  td: {
    fontSize: 8,
    padding: 6,
  },
  totalsRow: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: "#0a0a0a",
    backgroundColor: "#fafafa",
  },
  totalsLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    padding: 6,
  },
  totalsValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    padding: 6,
    textAlign: "right",
  },
  notes: {
    fontSize: 8,
    color: "#525252",
    marginTop: 4,
    whiteSpace: "preWrap",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#a3a3a3",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    paddingTop: 6,
  },
})

export type ProjectReportProps = {
  data: ProjectDetailData
  brand: {
    appName: string
    primaryColor: string
    tenantName: string
  }
  generatedAt: string
}

export function ProjectReport({ data, brand, generatedAt }: ProjectReportProps) {
  const { project, kpis, by_category, invoices } = data
  const totalsByStatus = invoices.reduce<Record<string, { count: number; sum: number }>>(
    (acc, inv) => {
      const k = inv.status
      const existing = acc[k] ?? { count: 0, sum: 0 }
      existing.count += 1
      existing.sum += Number(inv.total ?? 0)
      acc[k] = existing
      return acc
    },
    {},
  )

  const widthSupplier = "30%"
  const widthNumber = "15%"
  const widthDate = "12%"
  const widthCategory = "13%"
  const widthStatus = "12%"
  const widthTotal = "18%"

  return (
    <Document
      title={`Relatório · ${project.name}`}
      author={brand.tenantName}
      creator={brand.appName}
      producer={brand.appName}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.brand}>
            <View
              style={[
                styles.brandSquare,
                { backgroundColor: brand.primaryColor },
              ]}
            >
              <Text style={styles.brandLetter}>
                {brand.appName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.brandText}>
              <Text style={styles.brandName}>{brand.appName}</Text>
              <Text style={styles.brandTagline}>{brand.tenantName}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.meta}>Relatório de projeto</Text>
            <Text style={styles.meta}>Gerado em {generatedAt}</Text>
          </View>
        </View>

        <Text style={styles.title}>{project.name}</Text>
        <Text style={styles.subtitle}>
          {project.code ? `${project.code} · ` : ""}
          {project.client_name ? `Cliente: ${project.client_name} · ` : ""}
          {project.location ? `${project.location} · ` : ""}
          {project.start_date ? formatDatePdf(project.start_date) : "—"}
          {" → "}
          {project.end_date ? formatDatePdf(project.end_date) : "Em curso"}
        </Text>

        <View style={styles.badgeRow}>
          <Text style={styles.badge}>Tipo: {project.type}</Text>
          <Text style={styles.badge}>Estado: {project.status}</Text>
          {project.budget !== null && (
            <Text style={styles.badge}>
              Orçamento: {formatCurrencyPdf(project.budget)}
            </Text>
          )}
        </View>

        {project.description && (
          <Text style={styles.notes}>{project.description}</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo financeiro</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Total gasto</Text>
              <Text style={styles.kpiValue}>
                {formatCurrencyPdf(kpis.total_spent)}
              </Text>
              <Text style={styles.kpiHint}>{kpis.invoice_count} faturas</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Orçamento</Text>
              <Text style={styles.kpiValue}>
                {project.budget !== null
                  ? formatCurrencyPdf(project.budget)
                  : "—"}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Restante</Text>
              <Text style={styles.kpiValue}>
                {kpis.budget_remaining !== null
                  ? formatCurrencyPdf(kpis.budget_remaining)
                  : "—"}
              </Text>
              {kpis.pct_used !== null && (
                <Text style={styles.kpiHint}>
                  {Math.round(kpis.pct_used)}% usado
                </Text>
              )}
            </View>
          </View>
        </View>

        {by_category.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Distribuição por categoria</Text>
            <View style={styles.table}>
              {by_category.map((slice, idx) => {
                const isLast = idx === by_category.length - 1
                return (
                  <View
                    key={slice.category}
                    style={isLast ? styles.trLast : styles.tr}
                  >
                    <Text style={[styles.td, { flex: 1 }]}>
                      {CATEGORY_LABELS[slice.category] ?? slice.category}
                    </Text>
                    <Text
                      style={[styles.td, { width: 100, textAlign: "right" }]}
                    >
                      {formatCurrencyPdf(slice.value)}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Faturas ({invoices.length})
          </Text>
          <View style={styles.table}>
            <View style={[styles.tr, { backgroundColor: "#fafafa" }]} fixed>
              <Text style={[styles.th, { width: widthSupplier }]}>
                Fornecedor
              </Text>
              <Text style={[styles.th, { width: widthNumber }]}>Nº</Text>
              <Text style={[styles.th, { width: widthDate }]}>Data</Text>
              <Text style={[styles.th, { width: widthCategory }]}>
                Categoria
              </Text>
              <Text style={[styles.th, { width: widthStatus }]}>Estado</Text>
              <Text
                style={[styles.th, { width: widthTotal, textAlign: "right" }]}
              >
                Total
              </Text>
            </View>
            {invoices.length === 0 ? (
              <View style={styles.trLast}>
                <Text style={[styles.td, { flex: 1, color: "#a3a3a3" }]}>
                  Sem faturas associadas a este projeto.
                </Text>
              </View>
            ) : (
              invoices.map((inv, idx) => {
                const isLast = idx === invoices.length - 1
                return (
                  <View key={inv.id} style={isLast ? styles.trLast : styles.tr}>
                    <Text style={[styles.td, { width: widthSupplier }]}>
                      {inv.supplier_name ?? "—"}
                    </Text>
                    <Text style={[styles.td, { width: widthNumber }]}>
                      {inv.invoice_number ?? "—"}
                    </Text>
                    <Text style={[styles.td, { width: widthDate }]}>
                      {inv.invoice_date ? formatDatePdf(inv.invoice_date) : "—"}
                    </Text>
                    <Text style={[styles.td, { width: widthCategory }]}>
                      {inv.category
                        ? (CATEGORY_LABELS[inv.category] ?? inv.category)
                        : "—"}
                    </Text>
                    <Text style={[styles.td, { width: widthStatus }]}>
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </Text>
                    <Text
                      style={[
                        styles.td,
                        { width: widthTotal, textAlign: "right" },
                      ]}
                    >
                      {inv.total !== null ? formatCurrencyPdf(inv.total) : "—"}
                    </Text>
                  </View>
                )
              })
            )}
          </View>
        </View>

        {invoices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Totais por estado</Text>
            <View style={styles.table}>
              {Object.entries(totalsByStatus).map(([status, t], idx, arr) => {
                const isLast = idx === arr.length - 1
                return (
                  <View key={status} style={isLast ? styles.trLast : styles.tr}>
                    <Text style={[styles.td, { flex: 1 }]}>
                      {STATUS_LABELS[status] ?? status} · {t.count}{" "}
                      {t.count === 1 ? "fatura" : "faturas"}
                    </Text>
                    <Text
                      style={[styles.td, { width: 100, textAlign: "right" }]}
                    >
                      {formatCurrencyPdf(t.sum)}
                    </Text>
                  </View>
                )
              })}
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { flex: 1 }]}>
                  Total geral
                </Text>
                <Text style={[styles.totalsValue, { width: 100 }]}>
                  {formatCurrencyPdf(kpis.total_spent)}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            {brand.appName} · {brand.tenantName}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
