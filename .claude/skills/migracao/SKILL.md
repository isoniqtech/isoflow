---
name: migracao
description: Criar e aplicar uma migração de base de dados no ISOFlow (Supabase). Garante a ordem segura dev → prod → deploy, porque o código que lê colunas novas parte para TODOS os tenants se a migração não estiver aplicada. Usar sempre que for preciso alterar o schema.
---

# Migração de base de dados (ISOFlow)

As migrações **não são aplicadas automaticamente**. Corre-as o utilizador, à mão, no
SQL Editor do Supabase. A ordem é crítica.

## Regra que evita partir produção

> **A migração tem de estar aplicada ANTES do deploy do código que depende dela.**

Caso real: o `create-fc` passou a selecionar `expense_category_code`. Esse `select`
corre para **todos os tenants**, incluindo os que nada têm a ver com a funcionalidade.
Sem a coluna, o envio para ERP partia também para o FINMED.

Antes de escrever a migração, perguntar: **que código passa a ler ou escrever isto, e
para que tenants é que esse código corre?**

## 1. Escrever a migração

Numeração sequencial em `supabase/migrations/`. Verificar a última:
```bash
ls supabase/migrations/ | sort | tail -3
```

Boas práticas obrigatórias:
- **Aditiva**. Nunca alterar nem apagar o que existe sem autorização explícita.
- `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`
  antes de `CREATE POLICY` (para ser re-executável sem rebentar).
- Colunas novas **nullable** ou com `DEFAULT`. Nunca `NOT NULL` sem default.
- Tabelas novas precisam **sempre** de:
  ```sql
  ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "isolation_<t>" ON <t> USING (tenant_id = get_user_tenant_id());
  ```
- Índice em `tenant_id` (e nas colunas usadas em filtros).
- Comentários a explicar o **porquê** de cada bloco.

## 2. Dev primeiro

Pedir ao utilizador para correr no **Supabase dashboard → org "isoflow DEV" → projeto
"isoflow dev" → SQL Editor**, colando o ficheiro.

**Parar e esperar pela confirmação.** Não continuar sem ela.

## 3. Validar em dev

Depois de confirmado, verificar que ficou como esperado (tabela, colunas, políticas)
e testar o comportamento em test.isoniqtech.com.

## 4. Produção

Pedir para correr o **mesmo SQL** no projeto de produção (`utpnttkwexelciodgauh`).

**Parar e esperar pela confirmação.**

Confirmar via MCP Supabase que aplicou mesmo:
```sql
select
  (select count(*) from information_schema.tables  where table_name='<tabela>')  as tabela,
  (select count(*) from information_schema.columns where table_name='<t>' and column_name='<c>') as coluna;
```

## 5. Só então, deploy

Seguir a skill `deploy`. Ao pedir autorização para produção, dizer explicitamente que
a migração já está aplicada lá.

## Nota sobre tipos

`types/supabase.ts` é gerado e não conhece tabelas novas até ser regenerado. Enquanto
isso, no cliente admin tipado usar, com comentário a explicar:
```typescript
// Cast: a tabela e' da migration 0XX, ainda nao esta' em types/supabase.ts
const admin = createAdminClient() as unknown as SupabaseClient
```
