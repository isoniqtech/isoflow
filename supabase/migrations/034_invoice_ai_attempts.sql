-- Rastrear tentativas de extracao AI por fatura.
-- Permite retry indefinido enquanto ai_attempts < MAX sem limite de data.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ai_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ai_last_attempt_at timestamptz;

-- Inicializar faturas existentes com falha de AI
UPDATE invoices
SET ai_attempts = 1, ai_last_attempt_at = ai_processed_at
WHERE ai_processed_at IS NOT NULL
  AND supplier_name IS NULL
  AND file_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_ai_retry
  ON invoices(tenant_id, ai_attempts, needs_review)
  WHERE supplier_name IS NULL AND file_path IS NOT NULL;
