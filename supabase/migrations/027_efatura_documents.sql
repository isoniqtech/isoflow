-- Migration 027: documentos e-Fatura vindos do portal AT via Toconline
CREATE TABLE IF NOT EXISTS efatura_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identificadores externos
  toconline_id        text,                    -- ID do documento no Toconline
  at_document_id      text,                    -- ID do documento no portal AT

  -- Dados do documento
  document_number     text,                    -- Nº fatura do fornecedor (para cruzar)
  document_date       date,
  supplier_nif        text,
  supplier_name       text,
  total               numeric(10,2),
  subtotal            numeric(10,2),
  vat_amount          numeric(10,2),
  currency            text DEFAULT 'EUR',

  -- Estado AT (tal como vem do portal e-Fatura)
  at_status           text,                    -- ex: "compra_registada", "nao_considerado", "doc_contabilidade", "sem_associacao"

  -- Associação com fatura ISOFlow
  invoice_id          uuid REFERENCES invoices(id) ON DELETE SET NULL,
  matched_at          timestamptz,
  matched_by          text CHECK (matched_by IN ('auto', 'manual')),

  -- Dados brutos para referência
  raw_data            jsonb DEFAULT '{}',

  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  UNIQUE(tenant_id, toconline_id)
);

CREATE INDEX IF NOT EXISTS idx_efatura_tenant
  ON efatura_documents(tenant_id);

CREATE INDEX IF NOT EXISTS idx_efatura_document_number
  ON efatura_documents(tenant_id, document_number);

CREATE INDEX IF NOT EXISTS idx_efatura_supplier_nif
  ON efatura_documents(tenant_id, supplier_nif);

CREATE INDEX IF NOT EXISTS idx_efatura_unmatched
  ON efatura_documents(tenant_id, invoice_id)
  WHERE invoice_id IS NULL;

ALTER TABLE efatura_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isolation_efatura_documents" ON efatura_documents
  USING (tenant_id = get_user_tenant_id());
