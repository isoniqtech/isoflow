-- =============================================
-- MIGRATION 020 — UNIQUE (tenant_id, external_id) em bank_transactions
--
-- Garante idempotência do sync Tink: cada transação externa só pode
-- ter uma linha por tenant. external_id pode ser NULL (manual entry)
-- — nesse caso o índice é parcial (só aplica quando external_id IS NOT NULL).
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_tx_external
  ON public.bank_transactions (tenant_id, external_id)
  WHERE external_id IS NOT NULL;
