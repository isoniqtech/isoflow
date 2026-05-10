export async function GET(_req: Request) {
  return Response.json({ data: { balance: 0 } })
}
