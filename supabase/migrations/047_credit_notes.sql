-- =============================================
-- MIGRATION 047 - NOTAS DE CREDITO DE FORNECEDOR (NCF)
-- Aditiva. Nao altera nada existente.
-- =============================================
-- Distingue faturas de compra (FC) de notas de credito de fornecedor (NCF) na
-- mesma tabela `invoices`, e liga a NCF a fatura original DENTRO da app. O
-- TOConline cria a NCF autonoma, sem referencia ao FC (confirmado contra dados
-- reais em 2026-07-23) - por isso a ligacao FC<->NCF vive so aqui, para a UI e
-- para o calculo dos gastos (gasto = soma FC - soma NCF).
--
-- Seguranca all-tenants: `document_kind` tem DEFAULT 'invoice', logo todas as
-- faturas existentes (incluindo FINMED) continuam a ser tratadas como fatura.
-- Nenhum caminho de codigo muda de comportamento ate ao deploy que le a coluna.

-- Tipo de documento: 'invoice' (fatura -> FC no ERP) | 'credit_note' (nota de
-- credito -> NCF no ERP). Nao reaproveita `status` nem `type` (type e' a direcao
-- incoming/outgoing, nao o tipo de documento).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_kind text NOT NULL DEFAULT 'invoice';

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_document_kind_check
    CHECK (document_kind IN ('invoice', 'credit_note'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ligacao (so na app) da NCF a fatura de compra original. Auto-referencia.
-- ON DELETE SET NULL: apagar a fatura original nao apaga a nota de credito,
-- fica apenas "por associar" outra vez.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS related_invoice_id uuid
  REFERENCES invoices(id) ON DELETE SET NULL;

-- Referencia da fatura original lida pela IA (numero do documento a que a nota de
-- credito diz respeito), para o matching quando a NCF chega orfa (a fatura
-- original ainda nao existe na app).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS referenced_document_number text;

-- Indices ------------------------------------------------------------------

-- Lookups pela fatura original: mostrar as NCF de uma fatura e matching inverso
-- (ao entrar uma fatura nova, ligar as NCF que a referenciam).
CREATE INDEX IF NOT EXISTS idx_invoices_related_invoice
  ON invoices(related_invoice_id) WHERE related_invoice_id IS NOT NULL;

-- "Por associar": notas de credito ainda sem fatura original ligada, por tenant.
CREATE INDEX IF NOT EXISTS idx_invoices_credit_note_unlinked
  ON invoices(tenant_id) WHERE document_kind = 'credit_note' AND related_invoice_id IS NULL;

-- Agregacao de gastos (FC - NCF): filtrar por tenant + tipo de documento.
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_kind
  ON invoices(tenant_id, document_kind);

-- RLS: sem alteracoes. A policy existente `isolation_invoices`
-- (USING tenant_id = get_user_tenant_id()) ja cobre todas as linhas e comandos,
-- incluindo as notas de credito e as novas colunas. Nada a adicionar.
