-- =============================================
-- MIGRATION 015 — REVOKE HELPER FUNCTIONS FROM PUBLIC
-- O REVOKE de anon/authenticated em 014 não chega:
-- o Postgres concede EXECUTE a PUBLIC por defeito.
-- Revogamos PUBLIC. Continuam usáveis dentro de policies
-- (avaliação interna do Postgres não passa por permissões REST).
-- =============================================

REVOKE EXECUTE ON FUNCTION public.get_user_tenant_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC;
