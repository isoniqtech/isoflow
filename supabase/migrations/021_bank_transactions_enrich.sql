-- =============================================
-- MIGRATION 021 — Enriquecer bank_transactions com sinais para conciliação
--
-- Sinais adicionais extraídos de Tink (e que outros providers Open Banking
-- também devolvem) que tornam o matching com faturas mais preciso:
--
--   counterparty_name    — nome do payer/payee (ex: "MEDIAMARKET LDA")
--   counterparty_iban    — IBAN da contraparte (match contra invoices.supplier_*)
--   bank_reference       — referência transmitida pelo banco (pode ter nº fatura)
--   external_status      — BOOKED | PENDING | UNDEFINED. Não conciliar PENDING.
-- =============================================

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS counterparty_name text,
  ADD COLUMN IF NOT EXISTS counterparty_iban text,
  ADD COLUMN IF NOT EXISTS bank_reference   text,
  ADD COLUMN IF NOT EXISTS external_status  text
    CHECK (external_status IN ('BOOKED', 'PENDING', 'UNDEFINED'));

CREATE INDEX IF NOT EXISTS idx_bank_tx_counterparty_iban
  ON public.bank_transactions (tenant_id, counterparty_iban)
  WHERE counterparty_iban IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_tx_bank_reference
  ON public.bank_transactions (tenant_id, bank_reference)
  WHERE bank_reference IS NOT NULL;
