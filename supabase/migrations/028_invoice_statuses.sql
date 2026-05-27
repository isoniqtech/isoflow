-- Novos statuses: em_sistema, necessita_revisao, enviada_erp
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN (
    'pending','processing','matched','paid','rejected','duplicate','reconciled',
    'em_sistema','necessita_revisao','enviada_erp'
  ));

-- Migrar registos existentes
UPDATE invoices SET status = 'em_sistema'
  WHERE status IN ('pending', 'processing', 'matched');

-- Quando FC criada → enviada_erp
UPDATE invoices SET status = 'enviada_erp'
  WHERE toconline_fc_id IS NOT NULL AND status = 'em_sistema';

-- needs_review → necessita_revisao
UPDATE invoices SET status = 'necessita_revisao'
  WHERE needs_review = true AND status != 'rejeitada' AND status != 'duplicada';
