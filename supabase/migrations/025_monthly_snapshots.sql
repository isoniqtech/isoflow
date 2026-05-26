-- Snapshots de receita mensal vindos do Toconline via n8n
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month      integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year       integer NOT NULL CHECK (year >= 2000),
  revenue    numeric(12,2) DEFAULT 0,
  saved_at   timestamptz DEFAULT now(),
  UNIQUE(tenant_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_tenant_year
  ON monthly_snapshots(tenant_id, year);

ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isolation_monthly_snapshots" ON monthly_snapshots
  USING (tenant_id = get_user_tenant_id());
