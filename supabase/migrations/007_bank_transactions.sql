-- =============================================
-- MIGRATION 007 — BANK TRANSACTIONS
-- =============================================
CREATE TABLE bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  account_name text,
  bank_name text,
  iban text,
  external_id text,
  date date NOT NULL,
  value_date date,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  description text,
  type text CHECK (type IN ('debit','credit')),
  category text,
  mode text,
  invoice_id uuid REFERENCES invoices(id),
  matched_at timestamptz,
  matched_by text CHECK (matched_by IN ('auto','manual')),
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bank_tenant ON bank_transactions(tenant_id);
CREATE INDEX idx_bank_date ON bank_transactions(tenant_id, date);
CREATE INDEX idx_bank_unmatched ON bank_transactions(tenant_id, invoice_id)
  WHERE invoice_id IS NULL;
