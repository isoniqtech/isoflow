ALTER TABLE tenant_integrations ADD COLUMN IF NOT EXISTS sync_locked_until timestamptz DEFAULT NULL;
