-- =============================================
-- MIGRATION 008 — RECONCILIATIONS
-- =============================================
CREATE TABLE reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  bank_transaction_id uuid NOT NULL REFERENCES bank_transactions(id),
  match_type text NOT NULL CHECK (match_type IN ('auto','manual')),
  match_score numeric(3,2),
  status text DEFAULT 'pending'
    CHECK (status IN ('confirmed','pending','rejected')),
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  rejected_by uuid REFERENCES users(id),
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(invoice_id, bank_transaction_id)
);
