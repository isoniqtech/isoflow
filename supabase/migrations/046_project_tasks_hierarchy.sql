-- =============================================
-- MIGRATION 046 - HIERARQUIA E PROGRESSO DAS TAREFAS
-- Aditiva. Colunas novas, nullable ou com default.
-- Nenhuma policy e alterada: parent_id e' sempre uma tarefa do mesmo projeto,
-- por isso as policies de project_tasks ja' cobrem os filhos.
-- =============================================

-- Nivel 3 do cronograma: fase (phase, texto) > tarefa macro > subtarefa.
-- Apagar a tarefa macro apaga as subtarefas: uma subtarefa orfa nao tem
-- significado no Gantt.
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE;

-- Percentagem concluida, desenhada como preenchimento dentro da barra.
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS progress smallint NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE project_tasks
    ADD CONSTRAINT project_tasks_progress_range CHECK (progress BETWEEN 0 AND 100);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_pt_parent ON project_tasks(parent_id);
