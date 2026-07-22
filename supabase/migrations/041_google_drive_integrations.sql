-- =============================================
-- MIGRATION 041 - INTEGRACAO GOOGLE DRIVE (por tenant)
-- Aditiva. Nenhuma tabela ou policy existente e alterada.
-- =============================================

-- Tokens OAuth do Google Drive, um registo por tenant.
-- Scope minimo: drive.file (a app so' ve os ficheiros que ela propria cria).
-- Tokens SEMPRE cifrados (AES-256, lib/utils/encryption.ts) e nunca expostos
-- ao cliente - as chamadas ao Drive sao todas server-side.
CREATE TABLE IF NOT EXISTS google_drive_integrations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL UNIQUE
                          REFERENCES tenants(id) ON DELETE CASCADE,
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expiry            timestamptz,
  scope                   text,
  root_folder_id          text,          -- pasta "Projetos Flow" no Drive do tenant
  connected_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  connected_at            timestamptz,
  sync_error              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gdrive_tenant ON google_drive_integrations(tenant_id);
-- Suporte a crons de refresh proativo (mesmo padrao do token TOConline)
CREATE INDEX IF NOT EXISTS idx_gdrive_expiry ON google_drive_integrations(token_expiry);

ALTER TABLE google_drive_integrations ENABLE ROW LEVEL SECURITY;

-- Leitura restrita a quem gere integracoes. O investidor nunca ve esta tabela.
-- Escrita e' feita server-side com service role (contorna RLS), por isso basta
-- a policy de leitura para o painel de Definicoes.
DROP POLICY IF EXISTS "gdrive_admin_select" ON google_drive_integrations;
CREATE POLICY "gdrive_admin_select" ON google_drive_integrations
  FOR SELECT USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );
