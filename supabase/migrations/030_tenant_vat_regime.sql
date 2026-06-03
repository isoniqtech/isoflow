ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vat_regime text DEFAULT 'normal'
  CHECK (vat_regime IN ('isento', 'reduzido', 'intermedio', 'normal'));
