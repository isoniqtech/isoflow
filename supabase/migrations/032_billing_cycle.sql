-- =============================================
-- MIGRATION 015 — BILLING CYCLE + INTERNAL NOTES
-- Campos de gestão interna, invisíveis para os tenants
-- =============================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS next_billing_date date;
