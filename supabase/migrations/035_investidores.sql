-- =============================================
-- MIGRATION 035 - INVESTIDORES
-- Aditivo: nenhuma tabela/policy existente e alterada
-- =============================================

-- 1. Adicionar 'investidor' ao CHECK constraint do role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner','admin','accountant','member','investidor'));

-- 2. Tabela investidores
CREATE TABLE IF NOT EXISTS investidores (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  nome               text NOT NULL,
  email              text NOT NULL,
  estado             text NOT NULL DEFAULT 'pronto_para_investir'
                     CHECK (estado IN ('pronto_para_investir','em_investimento','nao_disponivel')),
  capital_disponivel numeric(12,2) NOT NULL DEFAULT 0,
  tipo_negocio       text[] NOT NULL DEFAULT '{}',
  notas              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_investidores_tenant ON investidores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_investidores_user   ON investidores(user_id);
CREATE INDEX IF NOT EXISTS idx_investidores_estado ON investidores(tenant_id, estado);

-- 3. Tabela de ligacao projeto <-> investidor
CREATE TABLE IF NOT EXISTS projeto_investidores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  investidor_id uuid NOT NULL REFERENCES investidores(id) ON DELETE CASCADE,
  percentagem   numeric(5,2) NOT NULL
                CHECK (percentagem > 0 AND percentagem <= 100),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(projeto_id, investidor_id)
);

CREATE INDEX IF NOT EXISTS idx_pi_projeto    ON projeto_investidores(projeto_id);
CREATE INDEX IF NOT EXISTS idx_pi_investidor ON projeto_investidores(investidor_id);

-- 4. RLS nas novas tabelas
ALTER TABLE investidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_investidores ENABLE ROW LEVEL SECURITY;

-- Helper: devolver o id do investidor do utilizador atual
CREATE OR REPLACE FUNCTION get_investidor_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT id FROM investidores WHERE user_id = auth.uid() LIMIT 1
$$;

-- 5. Policies em investidores
CREATE POLICY "investidores_admin_select" ON investidores
  FOR SELECT USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin','accountant')
  );

CREATE POLICY "investidores_own_select" ON investidores
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "investidores_admin_insert" ON investidores
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );

CREATE POLICY "investidores_admin_update" ON investidores
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );

CREATE POLICY "investidores_admin_delete" ON investidores
  FOR DELETE USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner','admin')
  );

-- Investidor pode actualizar apenas o seu registo
CREATE POLICY "investidores_own_update" ON investidores
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Policies em projeto_investidores
CREATE POLICY "pi_admin_select" ON projeto_investidores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = projeto_investidores.projeto_id
        AND p.tenant_id = get_user_tenant_id()
    )
    AND get_user_role() IN ('owner','admin','accountant')
  );

CREATE POLICY "pi_investidor_select" ON projeto_investidores
  FOR SELECT USING (
    investidor_id = get_investidor_id()
  );

CREATE POLICY "pi_admin_insert" ON projeto_investidores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = projeto_investidores.projeto_id
        AND p.tenant_id = get_user_tenant_id()
    )
    AND get_user_role() IN ('owner','admin')
  );

CREATE POLICY "pi_admin_delete" ON projeto_investidores
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = projeto_investidores.projeto_id
        AND p.tenant_id = get_user_tenant_id()
    )
    AND get_user_role() IN ('owner','admin')
  );
