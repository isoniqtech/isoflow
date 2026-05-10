-- =============================================
-- MIGRATION 003 — TENANT INTEGRATIONS
-- =============================================
CREATE TABLE tenant_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL
    CHECK (type IN ('erp','banking','whatsapp','email')),
  provider text NOT NULL,
  api_key_encrypted text,
  api_secret_encrypted text,
  config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, type, provider)
);
