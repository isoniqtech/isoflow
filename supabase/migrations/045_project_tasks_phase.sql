-- =============================================
-- MIGRATION 045 - FASE DA TAREFA (agrupamento no Gantt)
-- Aditiva. Coluna nullable, sem default: tarefas ja' existentes ficam com
-- phase NULL e sao mostradas num grupo "Sem fase".
-- Nenhuma policy e alterada.
-- =============================================

ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS phase text;

-- Ordena o Gantt: as fases aparecem pela ordem em que a IA as gerou.
-- NULL = sem fase, cai para o fim.
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS phase_order integer;

CREATE INDEX IF NOT EXISTS idx_pt_phase
  ON project_tasks(project_id, phase_order, sort_order);
