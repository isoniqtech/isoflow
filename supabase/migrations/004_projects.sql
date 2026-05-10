-- =============================================
-- MIGRATION 004 — PROJECTS
-- =============================================
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  type text DEFAULT 'obra'
    CHECK (type IN ('obra','projeto','departamento','cliente','outro')),
  status text DEFAULT 'active'
    CHECK (status IN ('active','completed','paused','cancelled')),
  budget numeric(10,2),
  budget_alert_threshold integer DEFAULT 80,
  start_date date,
  end_date date,
  color text DEFAULT '#2563EB',
  client_name text,
  location text,
  notes text,
  name_aliases text[] DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_status ON projects(tenant_id, status);
