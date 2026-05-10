-- =============================================
-- MIGRATION 018 — FIX: RESTORE EXECUTE ON RLS HELPERS
--
-- A migration 015 revogou EXECUTE de PUBLIC nas funções helper
-- get_user_tenant_id() e get_user_role(). Acontece que as RLS policies
-- avaliam expressões com a permissão do role atual (authenticated),
-- não com a do owner da função, mesmo sendo SECURITY DEFINER.
--
-- Sintoma: queries via REST/PostgREST falham com
--   "permission denied for function get_user_tenant_id"
-- e por consequência todas as tabelas com RLS ficam ilegíveis
-- para utilizadores autenticados (sem mensagem clara no UI).
--
-- Fix: conceder EXECUTE a authenticated e service_role (continuam
-- revogadas de anon e PUBLIC). Isto reintroduz o aviso do linter
-- "authenticated_security_definer_function_executable" — aceite
-- como trade-off necessário; a função apenas devolve uid()/role()
-- a partir de auth.uid() do próprio chamador, não há escalation.
-- =============================================

GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;
