-- Actualizar CHECK constraint (status é text, não enum)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('pending','processing','matched','paid','rejected','duplicate','reconciled'));

-- Índice para lookups por erp_document_id
CREATE INDEX IF NOT EXISTS idx_invoices_erp_document_id
  ON invoices(tenant_id, erp_document_id) WHERE erp_document_id IS NOT NULL;

-- Índice para queries por tipo e data (ex: faturas outgoing do mês)
CREATE INDEX IF NOT EXISTS idx_invoices_type_date
  ON invoices(tenant_id, type, invoice_date) WHERE status != 'rejected';
