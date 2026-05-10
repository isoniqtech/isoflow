-- =============================================
-- MIGRATION 019 — ENABLE REALTIME PARA support_messages
--
-- Adiciona a tabela à publication supabase_realtime para que clientes
-- com auth válida recebam eventos INSERT em tempo real (chat de tickets).
--
-- A publication existe sempre num projeto Supabase mas começa vazia;
-- cada tabela tem de ser explicitamente adicionada.
-- =============================================

DO $$
BEGIN
  -- Cria a publication se não existir (defensivo).
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Adiciona support_messages se ainda não estiver lá.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
END $$;
