-- =============================================
-- MIGRATION 001 — TENANTS
-- =============================================
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nif text UNIQUE,
  email text,
  phone text,
  address text,
  plan text DEFAULT 'starter'
    CHECK (plan IN ('starter','business','pro','enterprise')),
  credits_balance integer DEFAULT 0,
  credits_used_this_month integer DEFAULT 0,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  status text DEFAULT 'trial'
    CHECK (status IN ('trial','active','suspended','cancelled')),
  trial_ends_at timestamptz DEFAULT now() + interval '14 days',
  onboarding_completed boolean DEFAULT false,
  -- Branding
  logo_path text,
  logo_url text,
  favicon_path text,
  primary_color text DEFAULT '#2563EB',
  app_name text DEFAULT 'ISOFlow',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
