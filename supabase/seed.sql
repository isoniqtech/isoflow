-- =============================================================
-- SEED — Dados FAKE para ambiente DEV
-- NÃO correr em PRODUÇÃO — apenas para testes locais e staging
-- =============================================================

-- 1. Tenant de teste
INSERT INTO tenants (
  id, name, nif, email, phone, address,
  plan, credits_balance, status, onboarding_completed,
  primary_color, app_name
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Empresa Demo Lda',
  '509999999',
  'demo@empresademo.pt',
  '+351910000001',
  'Rua de Exemplo, 1, 1000-001 Lisboa',
  'business',
  1500,
  'active',
  true,
  '#2563EB',
  'ISOFlow Demo'
) ON CONFLICT (id) DO NOTHING;

-- 2. Utilizadores fake (sem auth.users real — apenas para testes de query)
-- Em dev com email confirm desativado, criar via Supabase Auth dashboard
-- INSERT INTO users ... será feito pelo trigger handle_new_user

-- 3. Projeto de teste
INSERT INTO projects (
  id, tenant_id, name, code, description,
  type, status, budget, budget_alert_threshold,
  start_date, end_date, color, client_name
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Obra Almada 2024',
  'ALM-2024',
  'Reabilitação edifício Almada',
  'obra',
  'active',
  50000.00,
  80,
  '2024-01-15',
  '2024-12-31',
  '#2563EB',
  'Cliente Demo SA'
) ON CONFLICT (id) DO NOTHING;

-- 4. Faturas de exemplo
INSERT INTO invoices (
  id, tenant_id, project_id,
  type, status,
  supplier_name, supplier_nif,
  invoice_number, invoice_date, due_date,
  subtotal, vat_rate, vat_amount, total,
  currency, description, category,
  source, ai_confidence
) VALUES
(
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'incoming', 'pending',
  'Materiais Construção SA', '501000001',
  'FT 2024/1001', '2024-03-01', '2024-04-01',
  812.50, 23, 186.88, 999.38,
  'EUR', 'Cimento e areia — Obra Almada', 'material',
  'manual', 0.95
),
(
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'incoming', 'matched',
  'Transportes Rápidos Lda', '502000002',
  'FR 2024/0055', '2024-03-05', '2024-03-20',
  325.00, 23, 74.75, 399.75,
  'EUR', 'Transporte de materiais', 'transporte',
  'email', 0.88
),
(
  '00000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'outgoing', 'paid',
  NULL, NULL,
  'FS 2024/0012', '2024-03-10', NULL,
  2000.00, 23, 460.00, 2460.00,
  'EUR', 'Serviços de gestão — Março 2024', 'servicos',
  'manual', NULL
) ON CONFLICT (id) DO NOTHING;
