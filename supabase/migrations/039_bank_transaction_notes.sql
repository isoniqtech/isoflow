-- =============================================
-- MIGRATION 039 - NOTAS POR MOVIMENTO BANCARIO
-- =============================================
-- Campo de texto livre por movimento, editavel pelo utilizador.
-- Aditiva e nullable. Flui para o campo "notes" do documento TOConline
-- (via fatura conciliada) para ficar visivel ao contabilista.

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS notes text;
