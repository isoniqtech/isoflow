-- Função para buscar faturas incoming com join aos docs e-Fatura
CREATE OR REPLACE FUNCTION get_invoices_with_efatura(
  p_tenant_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  supplier_name text,
  supplier_nif text,
  invoice_number text,
  invoice_date date,
  total numeric,
  currency text,
  status text,
  source text,
  toconline_fc_id text,
  at_communicated boolean,
  efatura_doc_id uuid,
  efatura_doc_number text,
  efatura_at_status text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    i.id,
    i.supplier_name,
    i.supplier_nif,
    i.invoice_number,
    i.invoice_date,
    i.total,
    i.currency,
    i.status,
    i.source,
    i.toconline_fc_id,
    i.at_communicated,
    ed.id          AS efatura_doc_id,
    ed.document_number AS efatura_doc_number,
    ed.at_status   AS efatura_at_status
  FROM invoices i
  LEFT JOIN efatura_documents ed
    ON ed.invoice_id = i.id AND ed.tenant_id = i.tenant_id
  WHERE i.tenant_id = p_tenant_id
    AND i.type = 'incoming'
    AND i.status != 'rejected'
    AND (p_user_id IS NULL OR i.created_by = p_user_id)
  ORDER BY i.invoice_date DESC NULLS LAST
  LIMIT 500;
$$;
