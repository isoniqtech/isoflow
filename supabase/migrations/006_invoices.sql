-- =============================================
-- MIGRATION 006 — INVOICES
-- =============================================
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  external_id text,
  type text NOT NULL DEFAULT 'incoming'
    CHECK (type IN ('incoming','outgoing')),
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','processing','matched',
                      'paid','rejected','duplicate')),
  supplier_name text,
  supplier_nif text,
  supplier_email text,
  supplier_address text,
  invoice_number text,
  invoice_date date,
  due_date date,
  subtotal numeric(10,2),
  vat_rate numeric(5,2),
  vat_amount numeric(10,2),
  total numeric(10,2),
  currency text DEFAULT 'EUR',
  description text,
  category text,
  source text DEFAULT 'manual'
    CHECK (source IN ('whatsapp','email','manual','api','erp')),
  sent_by text,
  sender_phone text,
  sender_email text,
  file_path text,
  file_name text,
  file_type text
    CHECK (file_type IN ('pdf','jpg','jpeg','png')),
  file_size_bytes integer,
  bank_transaction_id uuid,
  matched_at timestamptz,
  matched_by text CHECK (matched_by IN ('auto','manual')),
  match_score numeric(3,2),
  ai_confidence numeric(3,2),
  ai_raw_response jsonb,
  ai_processed_at timestamptz,
  needs_review boolean DEFAULT false,
  erp_synced boolean DEFAULT false,
  erp_synced_at timestamptz,
  erp_document_id text,
  at_communicated boolean DEFAULT false,
  at_communicated_at timestamptz,
  notes text,
  tags text[],
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_date ON invoices(tenant_id, invoice_date);
CREATE INDEX idx_invoices_supplier ON invoices(tenant_id, supplier_nif);
