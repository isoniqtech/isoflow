-- =============================================
-- MIGRATION 037 - DIRECT MODE CONFIG
-- ADITIVA: nenhum dado existente e alterado.
-- DEFAULT 'n8n' preserva todos os tenants em producao.
-- =============================================

-- 1. Modo de integracao por tenant
-- Visivel na UI de configuracoes como seletor de modo ERP.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS integration_mode text DEFAULT 'n8n'
  CHECK (integration_mode IN ('n8n', 'toconline_direct'));

-- 2. Credenciais OAuth completas para modo direto TOConline.
-- api_key_encrypted (ja existe) = access token
-- api_secret_encrypted (ja existe) = refresh token
-- Novos campos abaixo:
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS toconline_client_id text,
  ADD COLUMN IF NOT EXISTS toconline_client_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS toconline_token_expires_at timestamptz;

-- Indice para verificar expiracao de token sem full scan
CREATE INDEX IF NOT EXISTS idx_ti_toconline_token_exp
  ON tenant_integrations(tenant_id, toconline_token_expires_at)
  WHERE type = 'erp' AND provider = 'toconline';
