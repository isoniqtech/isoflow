-- =============================================
-- MIGRATION 013 — RLS POLICIES
-- =============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "isolation_projects" ON projects
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_project_members" ON project_members
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_invoices" ON invoices
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_bank" ON bank_transactions
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_reconciliations" ON reconciliations
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_tickets" ON support_tickets
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_messages" ON support_messages
  USING (ticket_id IN (
    SELECT id FROM support_tickets WHERE tenant_id = get_user_tenant_id()
  ));
CREATE POLICY "isolation_credits" ON credit_transactions
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_integrations" ON tenant_integrations
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_audit" ON audit_logs
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_subscriptions" ON subscriptions
  USING (tenant_id = get_user_tenant_id());
