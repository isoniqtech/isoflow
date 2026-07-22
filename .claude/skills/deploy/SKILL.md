---
name: deploy
description: Publicar alterações do ISOFlow. Corre typecheck e build, commita em develop e faz push. O merge para main (produção) exige autorização explícita do utilizador. Usar sempre que for para publicar código.
---

# Deploy do ISOFlow

Sequência obrigatória: **local → `develop` (test.isoniqtech.com) → `main` (flow.isoniqtech.com)**.

## 1. Verificar o estado

```bash
git status --short && git branch --show-current
```

- Se houver alterações inesperadas, mostrá-las ao utilizador antes de continuar.
- Se não estiveres em `develop`, mudar para lá (nunca desenvolver diretamente em `main`).

## 2. Validar (os dois, sempre)

```bash
npx tsc --noEmit -p tsconfig.json
npx next build
```

**Correr os dois não é opcional.** O `next build` é mais estrito que o `tsc` e já apanhou
erros que o `tsc` deixou passar. Se algum falhar, corrigir antes de commitar.

Nota: no build local aparecem erros "Supabase admin client requires..." - são normais
(faltam env vars localmente) e não fazem o build falhar. Confirmar `exit=0`.

## 3. Commit e push para develop

Mensagem de commit: descrever **o quê e porquê**, não só o quê. Se corrigiu um bug,
explicar a causa raiz. Terminar com:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

```bash
git add <ficheiros>
git commit -m "..."
git push origin develop
```

## 4. PARAR aqui

**Nunca fazer merge para `main` sem ordem explícita do utilizador** ("vai para prod",
"podes ir para produção", ou equivalente inequívoco).

Dizer ao utilizador o que ficou em `develop` e perguntar se quer levar a produção.
Se a alteração depender de uma migração, confirmar que já está aplicada em produção
(ver a skill `migracao`).

## 5. Só após autorização: produção

```bash
git checkout main
git pull origin main --ff-only
git diff --stat main develop          # confirmar que só entra o esperado
git log --oneline main..develop
git merge develop --no-ff -m "Merge branch 'develop': <resumo>"
git push origin main
git checkout develop
```

Se o merge abortar por alterações locais não commitadas, mostrar o `git diff` ao
utilizador antes de decidir (não descartar trabalho às cegas).

## 6. Confirmar o deploy

Verificar no Vercel que o deployment de produção ficou `READY` antes de dizer ao
utilizador que está no ar. Projeto `prj_72iGyBoYiY95jHOc4sUHn60lbBDv`,
team `team_mQMneMQ8iXoYuQj2CcBrz7bP`.

Um erro comum: o utilizador testa antes de o deploy terminar e recebe 404 ou vê
comportamento antigo. Confirmar o estado antes de pedir para testar.
