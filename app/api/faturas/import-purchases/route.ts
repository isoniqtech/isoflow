// Este endpoint foi descontinuado.
// Usar POST /api/webhooks/gastos para importar gastos mensais.
export async function POST() {
  return Response.json({ error: "Gone. Use POST /api/webhooks/gastos" }, { status: 410 })
}
