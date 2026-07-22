-- =============================================
-- MIGRATION 043 - DOCUMENTOS DE PROJETO
-- Aditiva. Nenhuma tabela ou policy existente e alterada.
-- =============================================

-- Metadados dos documentos. Os bytes vivem no Google Drive do tenant; aqui
-- guardamos apenas a referencia (drive_file_id) e o que e' preciso para listar
-- e controlar visibilidade.
CREATE TABLE IF NOT EXISTS project_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name           text NOT NULL,
  drive_file_id  text NOT NULL,
  mime_type      text,
  web_view_link  text,
  size_bytes     bigint,
  visibility     text NOT NULL DEFAULT 'interna'
                 CHECK (visibility IN ('interna','investidores')),
  uploaded_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pd_tenant  ON project_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pd_project ON project_documents(project_id, created_at DESC);
-- Suporta o filtro do portal do investidor
CREATE INDEX IF NOT EXISTS idx_pd_visibility ON project_documents(project_id, visibility);

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- Leitura: utilizadores internos do tenant veem tudo do seu tenant.
DROP POLICY IF EXISTS "pd_tenant_select" ON project_documents;
CREATE POLICY "pd_tenant_select" ON project_documents
  FOR SELECT USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin','accountant','member')
  );

-- Leitura do investidor: SO' documentos marcados para investidores E SO' dos
-- projetos a que esta' associado. Reforcado tambem na API.
DROP POLICY IF EXISTS "pd_investidor_select" ON project_documents;
CREATE POLICY "pd_investidor_select" ON project_documents
  FOR SELECT USING (
    visibility = 'investidores'
    AND EXISTS (
      SELECT 1 FROM projeto_investidores pi
      WHERE pi.projeto_id = project_documents.project_id
        AND pi.investidor_id = get_investidor_id()
    )
  );

-- Escrita: apenas owner/admin do tenant. O investidor nunca escreve.
DROP POLICY IF EXISTS "pd_admin_insert" ON project_documents;
CREATE POLICY "pd_admin_insert" ON project_documents
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );

DROP POLICY IF EXISTS "pd_admin_update" ON project_documents;
CREATE POLICY "pd_admin_update" ON project_documents
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );

DROP POLICY IF EXISTS "pd_admin_delete" ON project_documents;
CREATE POLICY "pd_admin_delete" ON project_documents
  FOR DELETE USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );
