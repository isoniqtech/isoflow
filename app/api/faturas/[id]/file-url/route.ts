import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "view_own")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const admin = createAdminClient()

  let query = supabase
    .from("invoices")
    .select("file_path, file_type")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)

  if (ctx.role === "member") {
    query = query.eq("created_by", ctx.userId)
  }

  const { data: invoice, error } = await query.maybeSingle()
  if (error) return jsonError("Database error", 500, error.message)
  if (!invoice) return jsonError("Not found", 404)
  if (!invoice.file_path) return jsonError("No file attached", 404)

  const bucket = process.env.INVOICE_FILES_BUCKET ?? "invoice-files"
  const { data: signed, error: signErr } = await admin.storage
    .from(bucket)
    .createSignedUrl(invoice.file_path, 3600)

  if (signErr || !signed) {
    return jsonError("Could not generate signed URL", 500, signErr?.message)
  }

  return Response.json({ url: signed.signedUrl, file_type: invoice.file_type })
}
