-- =============================================
-- MIGRATION 040 - CATEGORIAS DE GASTO TOCONLINE
-- Aditiva. Nao altera nada existente.
-- =============================================

-- Catalogo de categorias de gasto por tenant, sincronizado do TOConline
-- (GET {appBase}/api/expense_categories). O `code` e' o accounting_number,
-- que e' o item_code usado nas linhas da FC.
CREATE TABLE IF NOT EXISTS toconline_expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  tax_code text,                     -- NOR (23%) | INT (13%) | RED (6%) | ISE (0%)
  tax_deductibility integer,
  is_main boolean,
  synced_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_toc_expense_cat_tenant
  ON toconline_expense_categories(tenant_id);

ALTER TABLE toconline_expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "isolation_toc_expense_categories" ON toconline_expense_categories;
CREATE POLICY "isolation_toc_expense_categories" ON toconline_expense_categories
  USING (tenant_id = get_user_tenant_id());

-- Categoria escolhida para cada fatura: decidida automaticamente pela IA na
-- entrada da fatura e editavel no detalhe antes de enviar para o ERP.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS expense_category_code text;
