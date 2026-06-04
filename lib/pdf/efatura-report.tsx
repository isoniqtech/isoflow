import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const AT_STATUS_LABELS: Record<string, string> = {
  Pendente: "Pendente",
  Associada: "Compra Registada",
  compra_registada: "Compra Registada",
  doc_contabilidade: "Doc. Contabilidade",
  nao_considerado: "Não Considerado",
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(value))
}

function fmtDate(input: unknown): string {
  if (!input) return "—"
  try { return new Intl.DateTimeFormat("pt-PT").format(new Date(input as string)) } catch { return "—" }
}

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 8, color: "#111", lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  meta: { fontSize: 8, color: "#6b7280", textAlign: "right" },
  thead: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 5, paddingHorizontal: 4, borderRadius: 3, marginTop: 8 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#374151" },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  td: { fontSize: 7.5 },
  cFornecedor: { flex: 2.5 },
  cNum: { flex: 1.5 },
  cData: { flex: 1 },
  cTotal: { flex: 0.9, textAlign: "right" },
  cEstado: { flex: 1.5 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#9ca3af" },
})

export function EFaturaExportReport({
  docs,
  tenantName,
  generatedAt,
  filters,
}: {
  docs: Record<string, unknown>[]
  tenantName: string
  generatedAt: string
  filters?: string
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Documentos e-Fatura</Text>
            <Text style={s.subtitle}>{tenantName}</Text>
            {filters && <Text style={[s.subtitle, { marginTop: 4 }]}>Estado AT: {filters}</Text>}
          </View>
          <View>
            <Text style={s.meta}>Gerado em {generatedAt}</Text>
            <Text style={s.meta}>{docs.length} documento{docs.length !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        <View style={s.thead}>
          <Text style={[s.th, s.cFornecedor]}>Fornecedor / NIF</Text>
          <Text style={[s.th, s.cNum]}>Nº Documento</Text>
          <Text style={[s.th, s.cData]}>Data</Text>
          <Text style={[s.th, s.cTotal]}>Total</Text>
          <Text style={[s.th, s.cEstado]}>Estado AT</Text>
        </View>

        {docs.map((doc, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={[s.td, s.cFornecedor]}>
              {(doc.supplier_name as string) ?? "—"}
              {doc.supplier_nif ? `\n${doc.supplier_nif as string}` : ""}
            </Text>
            <Text style={[s.td, s.cNum]}>{(doc.document_number as string) ?? "—"}</Text>
            <Text style={[s.td, s.cData]}>{fmtDate(doc.document_date)}</Text>
            <Text style={[s.td, s.cTotal]}>{fmt(doc.total)}</Text>
            <Text style={[s.td, s.cEstado]}>{AT_STATUS_LABELS[doc.at_status as string] ?? (doc.at_status as string) ?? "—"}</Text>
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{tenantName} · ISOFlow</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
