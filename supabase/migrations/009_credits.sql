-- =============================================
-- MIGRATION 009 — CREDITS
-- =============================================
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan text NOT NULL,
  price_monthly numeric NOT NULL,
  credits_monthly integer NOT NULL,
  status text DEFAULT 'active'
    CHECK (status IN ('active','cancelled','past_due','trialing')),
  stripe_subscription_id text UNIQUE,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL
    CHECK (type IN ('purchase','usage','refund','bonus','monthly_reset')),
  description text,
  reference_id uuid,
  reference_type text,
  balance_after integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_credits_tenant ON credit_transactions(tenant_id);
