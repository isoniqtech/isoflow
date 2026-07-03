-- =============================================
-- MIGRATION 036 - INVESTIDOR PERFIL
-- =============================================

-- Guardar o valor em euros alocado ao projeto no momento da ligacao
-- Necessario para restaurar capital ao desligar o investidor do projeto
ALTER TABLE projeto_investidores
  ADD COLUMN IF NOT EXISTS valor_alocado numeric(10,2);
