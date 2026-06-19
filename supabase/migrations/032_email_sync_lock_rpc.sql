CREATE OR REPLACE FUNCTION acquire_email_sync_lock(
  p_integration_id uuid,
  p_lock_until timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE tenant_integrations
  SET sync_locked_until = p_lock_until
  WHERE id = p_integration_id
    AND (sync_locked_until IS NULL OR sync_locked_until < now());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
