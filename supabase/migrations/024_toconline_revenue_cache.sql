-- Cache do total de receita mensal vindo do Toconline via n8n
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS toconline_revenue_total   numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toconline_revenue_month   integer,
  ADD COLUMN IF NOT EXISTS toconline_revenue_year    integer,
  ADD COLUMN IF NOT EXISTS toconline_revenue_cached_at timestamptz;
