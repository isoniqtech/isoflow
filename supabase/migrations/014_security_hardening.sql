-- =============================================
-- MIGRATION 014 — SECURITY HARDENING
-- Endereça os avisos do Supabase advisor:
--  1. RLS sem policies em tenants, users, role_permissions
--  2. search_path mutável em get_user_tenant_id e get_user_role
--  3. SECURITY DEFINER functions executáveis por anon e authenticated
-- =============================================

-- 1. Policies para destrancar tenants, users, role_permissions
CREATE POLICY "isolation_tenants" ON tenants
  USING (id = get_user_tenant_id());

CREATE POLICY "isolation_users" ON users
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "isolation_role_permissions" ON role_permissions
  USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

-- 2. Fixar search_path nas funções helper para evitar SQL injection via search_path
ALTER FUNCTION public.get_user_tenant_id() SET search_path = public;
ALTER FUNCTION public.get_user_role() SET search_path = public;

-- 3. Revogar EXECUTE direto via REST (anon, authenticated).
-- Continuam usáveis dentro de policies (avaliação interna do Postgres).
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon, authenticated;
