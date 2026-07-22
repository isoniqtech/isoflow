-- =============================================
-- MIGRATION 042 - PASTA DO PROJETO NO DRIVE + NOME UNICO POR TENANT
-- Aditiva. Nenhuma policy existente e alterada.
-- =============================================

-- Subpasta do projeto dentro de "Projetos Flow". Nullable: projetos criados
-- antes desta funcionalidade ficam a null e a pasta e' criada de forma lazy
-- no primeiro upload de documento.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_folder_id text;

-- Nome de projeto unico por tenant.
-- A pasta no Drive e' identificada pelo nome do projeto, por isso permitir
-- nomes repetidos criaria ambiguidade sobre onde guardar os documentos.
--
-- Verificado em producao antes de aplicar: ZERO duplicados existentes.
-- Se alguma instalacao tiver duplicados, esta migration falha aqui de
-- proposito - resolver os duplicados primeiro, nao remover a constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_tenant_name_unique
  ON projects(tenant_id, name);
