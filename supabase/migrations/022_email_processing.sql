-- =============================================
-- MIGRATION 022 — EMAIL PROCESSING
-- Suporte para inbound de faturas via Gmail IMAP (per-tenant).
-- 3 níveis de anti-duplicação: email_message_id, file_hash, dados da fatura.
-- =============================================

-- 1) Adicionar campos à tabela invoices ----------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS email_message_id text,
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS file_hash text;

-- Permitir source = 'email' (já existia no CHECK; confirmar)
-- O enum já inclui 'email' na migration 006, nada a fazer.

-- 2) Índices anti-duplicados ---------------------------

-- Nível 1: mesmo email não pode produzir invoices duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_email_message_id
  ON public.invoices(tenant_id, email_message_id)
  WHERE email_message_id IS NOT NULL;

-- Nível 2: hash do ficheiro evita re-processar o mesmo anexo
CREATE INDEX IF NOT EXISTS idx_invoices_file_hash
  ON public.invoices(tenant_id, file_hash)
  WHERE file_hash IS NOT NULL;

-- Nível 3: (NIF + número + data) é a identidade lógica da fatura
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_invoice
  ON public.invoices(tenant_id, supplier_nif, invoice_number, invoice_date)
  WHERE supplier_nif IS NOT NULL
    AND invoice_number IS NOT NULL
    AND status <> 'rejected';

-- 3) Tabela: log de processamento de emails ------------
CREATE TABLE IF NOT EXISTS public.email_processing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_message_id text NOT NULL,
  from_email text,
  subject text,
  processed_at timestamptz DEFAULT now(),
  attachments_found integer DEFAULT 0,
  attachments_processed integer DEFAULT 0,
  invoices_created integer DEFAULT 0,
  duplicates_skipped integer DEFAULT 0,
  errors integer DEFAULT 0,
  status text DEFAULT 'success'
    CHECK (status IN ('success','partial','error')),
  details jsonb DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_log_tenant
  ON public.email_processing_log(tenant_id, processed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_message_id
  ON public.email_processing_log(tenant_id, email_message_id);

-- 4) Tabela: emails de remetentes não reconhecidos -----
CREATE TABLE IF NOT EXISTS public.unmatched_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email text NOT NULL,
  subject text,
  received_at timestamptz DEFAULT now(),
  attachment_path text,
  raw_data jsonb,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','assigned','ignored')),
  assigned_to_tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz DEFAULT now()
);

-- 5) RLS -----------------------------------------------
ALTER TABLE public.email_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unmatched_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "isolation_email_log" ON public.email_processing_log;
CREATE POLICY "isolation_email_log" ON public.email_processing_log
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "isolation_unmatched" ON public.unmatched_emails;
CREATE POLICY "isolation_unmatched" ON public.unmatched_emails
  USING (true);
-- nota: unmatched_emails é gerido via service_role; "true" permite leitura
-- por qualquer authenticated mas writes serão sempre via service_role.
