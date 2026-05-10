-- =============================================
-- MIGRATION 016 — TRIGGER handle_new_user
-- Quando um auth.user é criado:
--  1. Cria automaticamente um novo tenant
--  2. Cria a user row em public.users com role=owner
-- Espera metadata em raw_user_meta_data:
--  { name, company_name, nif? }
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  INSERT INTO public.tenants (name, nif, email)
  VALUES (
    coalesce(NEW.raw_user_meta_data->>'company_name', NEW.email),
    nullif(NEW.raw_user_meta_data->>'nif', ''),
    NEW.email
  )
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.users (id, tenant_id, name, email, role)
  VALUES (
    NEW.id,
    new_tenant_id,
    coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'owner'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
