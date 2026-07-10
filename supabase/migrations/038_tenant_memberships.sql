-- =============================================
-- MIGRATION 038 - TENANT MEMBERSHIPS
-- Permite utilizadores pertencerem a multiplos tenants
-- =============================================

CREATE TABLE tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','accountant','member','investidor')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz DEFAULT now(),
  status text DEFAULT 'active'
    CHECK (status IN ('pending','active','revoked')),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_memberships_user ON tenant_memberships(user_id);
CREATE INDEX idx_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX idx_memberships_active ON tenant_memberships(user_id, status) WHERE status = 'active';

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Utilizador ve as suas proprias memberships; admins veem as do seu tenant
CREATE POLICY "memberships_view" ON tenant_memberships
  USING (
    user_id = auth.uid()
    OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "memberships_manage" ON tenant_memberships
  FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- =============================================
-- Actualizar get_user_tenant_id para suportar switching
-- Le active_tenant_id do JWT app_metadata se presente
-- e verifica que o utilizador tem acesso a esse tenant
-- =============================================
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid AS $$
DECLARE
  active_tenant uuid;
  primary_tenant uuid;
BEGIN
  -- Verificar se ha um tenant activo explicito no JWT
  BEGIN
    active_tenant := (auth.jwt() -> 'app_metadata' ->> 'active_tenant_id')::uuid;
  EXCEPTION WHEN others THEN
    active_tenant := NULL;
  END;

  IF active_tenant IS NOT NULL THEN
    -- Verificar que o utilizador tem acesso a este tenant
    IF EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tenant_id = active_tenant
    ) OR EXISTS (
      SELECT 1 FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = active_tenant
        AND status = 'active'
    ) THEN
      RETURN active_tenant;
    END IF;
  END IF;

  -- Fallback: tenant primario da tabela users
  SELECT tenant_id INTO primary_tenant
  FROM public.users WHERE id = auth.uid();

  RETURN primary_tenant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
