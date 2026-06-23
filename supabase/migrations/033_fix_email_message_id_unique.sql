-- O unique index em email_message_id impedia multiplas faturas do mesmo email.
-- Um email com 3 PDFs anexados deve gerar 3 faturas - todas com o mesmo
-- email_message_id. O indice unico bloqueava o 2o e seguintes com erro 23505,
-- contados incorrectamente como "duplicados".
--
-- Substituir por indice nao-unico (mantemos para queries de lookup/delete do log).

DROP INDEX IF EXISTS public.idx_invoices_email_message_id;

CREATE INDEX IF NOT EXISTS idx_invoices_email_message_id
  ON public.invoices(tenant_id, email_message_id)
  WHERE email_message_id IS NOT NULL;
