import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import type { InvestidorDetail } from "@/lib/queries/investidores"

const ESTADO_LABELS: Record<string, string> = {
  pronto_para_investir: "Pronto para investir",
  em_investimento: "Em investimento",
  nao_disponivel: "Nao disponivel",
}

const TIPO_LABELS: Record<string, string> = {
  terreno: "Terreno",
  casa: "Casa",
  edificio: "Edificio",
}

function fmt(value: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value)
}

function fmtDate(input: string | null | undefined): string {
  if (!input) return "-"
  try {
    return new Intl.DateTimeFormat("pt-PT").format(new Date(input))
  } catch {
    return "-"
  }
}

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9, color: "#111827" },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 2 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 140, color: "#6b7280" },
  value: { flex: 1 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  colProjeto: { flex: 2 },
  colPct: { width: 40, textAlign: "right" },
  colBudget: { width: 90, textAlign: "right" },
  colAlocado: { width: 90, textAlign: "right" },
  colGasto: { width: 90, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    marginTop: 2,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 20, color: "#9ca3af", fontSize: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 },
})

export function InvestorReport({
  data,
  generatedAt,
}: {
  data: InvestidorDetail
  generatedAt: string
}) {
  const totalAlocado = data.projetos.reduce((s, p) => s + (p.valor_estimado ?? 0), 0)
  const totalGasto = data.projetos.reduce((s, p) => s + p.total_gasto, 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.nome}</Text>
          <Text style={styles.subtitle}>Relatorio de Investidor</Text>
          <Text style={styles.subtitle}>Gerado em {fmtDate(generatedAt)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados Gerais</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{data.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Estado</Text>
            <Text style={styles.value}>{ESTADO_LABELS[data.estado] ?? data.estado}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Capital disponivel</Text>
            <Text style={styles.value}>{fmt(data.capital_disponivel)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tipo de negocio</Text>
            <Text style={styles.value}>
              {data.tipo_negocio.map((t) => TIPO_LABELS[t] ?? t).join(", ") || "-"}
            </Text>
          </View>
          {data.notas && (
            <View style={styles.row}>
              <Text style={styles.label}>Notas</Text>
              <Text style={styles.value}>{data.notas}</Text>
            </View>
          )}
        </View>

        {data.projetos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projetos ({data.projetos.length})</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.colProjeto, styles.bold]}>Projeto</Text>
              <Text style={[styles.colPct, styles.bold]}>%</Text>
              <Text style={[styles.colBudget, styles.bold]}>Orcamento</Text>
              <Text style={[styles.colAlocado, styles.bold]}>Alocado</Text>
              <Text style={[styles.colGasto, styles.bold]}>Gasto total</Text>
            </View>
            {data.projetos.map((p) => (
              <View key={p.id} style={styles.tableRow}>
                <Text style={styles.colProjeto}>
                  {p.nome}{p.code ? ` (${p.code})` : ""}
                </Text>
                <Text style={styles.colPct}>{p.percentagem}%</Text>
                <Text style={styles.colBudget}>{p.budget !== null ? fmt(p.budget) : "-"}</Text>
                <Text style={styles.colAlocado}>
                  {p.valor_estimado !== null ? fmt(p.valor_estimado) : "-"}
                </Text>
                <Text style={styles.colGasto}>{fmt(p.total_gasto)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={[styles.colProjeto, styles.bold]}>Total</Text>
              <Text style={styles.colPct} />
              <Text style={styles.colBudget} />
              <Text style={[styles.colAlocado, styles.bold]}>{fmt(totalAlocado)}</Text>
              <Text style={[styles.colGasto, styles.bold]}>{fmt(totalGasto)}</Text>
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          ISOFlow by ISONIQ TECH - Documento gerado automaticamente
        </Text>
      </Page>
    </Document>
  )
}
