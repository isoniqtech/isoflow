-- =============================================
-- MIGRATION 044 - TAREFAS / PLANEAMENTO DE PROJETO
-- Aditiva. Nenhuma tabela ou policy existente e alterada.
-- =============================================

-- Tarefas standalone: nesta fase nao ha' ligacao a faturas nem a orcamento.
CREATE TABLE IF NOT EXISTS project_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  start_date  date,
  end_date    date,
  status      text NOT NULL DEFAULT 'por_iniciar'
              CHECK (status IN ('por_iniciar','em_curso','concluida','bloqueada')),
  -- 'admin' = so' a equipa ve; 'todos' = visivel tambem no portal do investidor
  visibility  text NOT NULL DEFAULT 'todos'
              CHECK (visibility IN ('admin','todos')),
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_tenant  ON project_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pt_project ON project_tasks(project_id, sort_order, start_date);
-- Suporta o filtro do portal do investidor
CREATE INDEX IF NOT EXISTS idx_pt_visibility ON project_tasks(project_id, visibility);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- Leitura: utilizadores internos do tenant veem todas as tarefas do tenant.
DROP POLICY IF EXISTS "pt_tenant_select" ON project_tasks;
CREATE POLICY "pt_tenant_select" ON project_tasks
  FOR SELECT USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin','accountant','member')
  );

-- Leitura do investidor: SO' tarefas 'todos' E SO' dos projetos a que esta'
-- associado. Reforcado tambem na API.
DROP POLICY IF EXISTS "pt_investidor_select" ON project_tasks;
CREATE POLICY "pt_investidor_select" ON project_tasks
  FOR SELECT USING (
    visibility = 'todos'
    AND EXISTS (
      SELECT 1 FROM projeto_investidores pi
      WHERE pi.projeto_id = project_tasks.project_id
        AND pi.investidor_id = get_investidor_id()
    )
  );

-- Escrita: apenas owner/admin do tenant. O investidor nunca escreve.
DROP POLICY IF EXISTS "pt_admin_insert" ON project_tasks;
CREATE POLICY "pt_admin_insert" ON project_tasks
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );

DROP POLICY IF EXISTS "pt_admin_update" ON project_tasks;
CREATE POLICY "pt_admin_update" ON project_tasks
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );

DROP POLICY IF EXISTS "pt_admin_delete" ON project_tasks;
CREATE POLICY "pt_admin_delete" ON project_tasks
  FOR DELETE USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );
