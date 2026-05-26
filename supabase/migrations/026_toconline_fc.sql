-- Migration 026: toconline_fc_id para associar faturas às FCs criadas no TOConline
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS toconline_fc_id text;

CREATE INDEX IF NOT EXISTS idx_invoices_toconline_fc
  ON invoices(tenant_id, toconline_fc_id)
  WHERE toconline_fc_id IS NOT NULL;
