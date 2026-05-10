-- =============================================
-- MIGRATION 017 — DEV: AUTO-CONFIRMAR EMAIL DOS NOVOS UTILIZADORES
-- ⚠️ Apenas para desenvolvimento. REMOVER antes de ir para produção.
--
-- Trigger BEFORE INSERT em auth.users que define email_confirmed_at = now(),
-- equivalente a desligar "Confirm email" no dashboard. Permite testar o
-- flow de registo end-to-end sem clicar no link de confirmação por email.
--
-- Para reverter:
--   DROP TRIGGER IF EXISTS dev_auto_confirm_email ON auth.users;
--   DROP FUNCTION IF EXISTS public.dev_auto_confirm_email();
-- =============================================

CREATE OR REPLACE FUNCTION public.dev_auto_confirm_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dev_auto_confirm_email() FROM PUBLIC;

CREATE TRIGGER dev_auto_confirm_email
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.dev_auto_confirm_email();
