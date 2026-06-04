import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import type { InvoiceListItem } from "@/lib/queries/invoices"

const STATUS_LABELS: Record<string, string> = {
  em_sistema: "Em Sistema",
  necessita_revisao: "Necessita Revisão",
  enviada_erp: "Enviada ERP",
  pending: "Em Sistema",
  processing: "Em Sistema",
  matched: "Em Sistema",
  paid: "Em Sistema",
  reconciled: "Em Sistema",
  rejected: "Rejeitada",
  duplicate: "Duplicada",
}

function fmt(value: number | null): string {
  if (value === null) return "—"
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value)
}

function fmtDate(input: string | null | undefined): string {
  if (!input) return "—"
  try { return new Intl.DateTimeFormat("pt-PT").format(new Date(input)) } catch { return "—" }
}

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 8, color: "#111", lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  meta: { fontSize: 8, color: "#6b7280", textAlign: "right" },
  table: { marginTop: 8 },
  thead: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 5, paddingHorizontal: 4, borderRadius: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#374151" },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  td: { fontSize: 7.5, color: "#111" },
  // column widths
  cFornecedor: { flex: 2.5 },
  cNum: { flex: 1.2 },
  cData: { flex: 1 },
  cProjeto: { flex: 1.5 },
  cCategoria: { flex: 1.2 },
  cEstado: { flex: 1.2 },
  cTotal: { flex: 0.9, textAlign: "right" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#9ca3af" },
})

export function FaturasReport({
  invoices,
  tenantName,
  generatedAt,
  filters,
}: {
  invoices: InvoiceListItem[]
  tenantName: string
  generatedAt: string
  filters?: string
}) {
  const total = invoices.reduce((s, i) => s + (i.total ?? 0), 0)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Exportação de Faturas</Text>
            <Text style={s.subtitle}>{tenantName}</Text>
            {filters && <Text style={[s.subtitle, { marginTop: 4 }]}>Filtros: {filters}</Text>}
          </View>
          <View>
            <Text style={s.meta}>Gerado em {generatedAt}</Text>
            <Text style={s.meta}>{invoices.length} fatura{invoices.length !== 1 ? "s" : ""} · Total: {fmt(total)}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.th, s.cFornecedor]}>Fornecedor</Text>
            <Text style={[s.th, s.cNum]}>Nº Fatura</Text>
            <Text style={[s.th, s.cData]}>Data</Text>
            <Text style={[s.th, s.cProjeto]}>Projeto</Text>
            <Text style={[s.th, s.cCategoria]}>Categoria</Text>
            <Text style={[s.th, s.cEstado]}>Estado</Text>
            <Text style={[s.th, s.cTotal]}>Total</Text>
          </View>

          {invoices.map((inv) => (
            <View key={inv.id} style={s.row} wrap={false}>
              <Text style={[s.td, s.cFornecedor]}>{inv.supplier_name ?? "—"}</Text>
              <Text style={[s.td, s.cNum]}>{inv.invoice_number ?? "—"}</Text>
              <Text style={[s.td, s.cData]}>{fmtDate(inv.invoice_date)}</Text>
              <Text style={[s.td, s.cProjeto]}>{inv.project?.name ?? "—"}</Text>
              <Text style={[s.td, s.cCategoria]}>{inv.category ?? "—"}</Text>
              <Text style={[s.td, s.cEstado]}>{STATUS_LABELS[inv.status] ?? inv.status}</Text>
              <Text style={[s.td, s.cTotal]}>{fmt(inv.total)}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{tenantName} · ISOFlow</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
