# CLAUDE.md - ISOFlow by ISONIQ TECH

## LEITURA OBRIGATÓRIA
Lê este ficheiro COMPLETO antes de escrever qualquer linha de código.
Lê também PRD.md, TECH.md e TASKS.md antes de começar qualquer tarefa.

## ✍️ Regras de Escrita
- **NUNCA usar travessão longo (—) em nenhum texto, label, título ou comentário de código.**
  Usar hífen (-) ou reescrever a frase sem travessão.

---

## 🎯 O Produto

**ISOFlow** é uma plataforma SaaS multi-tenant portuguesa para gestão automática de
faturas, conciliação bancária e controlo de projetos/obras. Desenvolvida pela
ISONIQ TECH (isoniqtech.com).

### Proposta de valor
- Recebe faturas via Email e WhatsApp automaticamente
- Lê e extrai dados com IA (Claude API)
- Organiza por projetos / obras / centros de custo
- Concilia faturas com movimentos bancários (Open Banking + import de extratos)
- Cruza com a e-Fatura da AT
- Lança faturas de compra (FC) no ERP TOConline
- Vendida como SaaS com subscrição mensal

### Clientes em produção
| Tenant | Modo ERP | Notas |
|---|---|---|
| **FINMED** | `n8n` | Cliente original. Workflows n8n próprios. **Nunca alterar o caminho n8n.** |
| **Revive Home Unipessoal Lda** | `toconline_direct` | Piloto do modo direto (TOConline `app13`) |

---

## 🌐 Ambientes - LEITURA OBRIGATÓRIA ANTES DE TOCAR NA DB

| | Preview (Dev) | Produção |
|---|---|---|
| **URL** | test.isoniqtech.com | flow.isoniqtech.com |
| **Branch Git** | `develop` | `main` |
| **Supabase Org** | isoflow DEV | Isoniq Tech |
| **Supabase Projeto** | isoflow dev | isoflow (`utpnttkwexelciodgauh`) |
| **Vercel Target** | preview | production |

### Sequência obrigatória
1. **Local** - desenvolver e testar (`npx tsc --noEmit` + `npx next build`)
2. **`develop`** - commit + push → deploy automático para test.isoniqtech.com
3. **`main`** - só após validação, merge develop→main → deploy para produção

GitHub: https://github.com/isoniqtech/isoflow
Vercel: projeto `isoflow` (`prj_72iGyBoYiY95jHOc4sUHn60lbBDv`)

### Regras absolutas de ambiente
- NUNCA saltar passos: local → dev → prod
- **NUNCA fazer merge para `main` sem ordem explícita do utilizador**
- O MCP Supabase está ligado a **PRODUÇÃO**
- Migrações: correr **manualmente** no SQL Editor do Supabase (dev primeiro, prod depois)
- **Migração ANTES do deploy** quando o código passa a ler/escrever colunas novas.
  Exemplo real: o `create-fc` passou a selecionar `expense_category_code` para todos
  os tenants; sem a coluna, partia também o FINMED.

---

## 🏗️ Stack Técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 App Router (Server + Client Components) |
| Base de dados | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (JWT, convites, multi-tenant) |
| Storage | Supabase Storage (PDFs/imagens de faturas, logos) |
| IA | Claude API (`claude-sonnet-4-20250514` por defeito, configurável por tenant) |
| Email inbound | Gmail IMAP por tenant |
| WhatsApp | Twilio WhatsApp Business API |
| Open Banking | **Tink** (substituiu Salt Edge) |
| ERP | TOConline (modo direto por OAuth **ou** via n8n) |
| Pagamentos | Stripe subscriptions |
| Deploy | Vercel (CI/CD automático + Cron Jobs) |
| Linguagem | TypeScript strict (sem `any`, sem `ts-ignore`) |
| Estilos | Tailwind CSS + shadcn/ui + Lucide |
| Formulários | React Hook Form + Zod |
| Ficheiros | `unpdf` (PDF), `xlsx` (Excel), `papaparse` (CSV) |
| Toasts | Sonner |

---

## 📁 Estrutura Real

```
app/
├── (auth)/            login, register, forgot-password, reset-password
├── (marketing)/       landing page
├── (dashboard)/
│   ├── dashboard/                 KPIs, gráficos receita vs gastos
│   ├── faturas/  [id]  nova/      lista + tab e-Fatura, detalhe, upload
│   ├── projetos/ [id]  [id]/editar  novo/
│   │                              [id] tem 3 tabs por ?tab=:
│   │                              dashboard · documentacao · planeamento
│   ├── investidores/ [id]  novo/
│   ├── banco/                     movimentos + import de extratos
│   ├── conciliacao/               split view
│   ├── suporte/  [id]  novo/
│   ├── perfil/
│   └── configuracoes/  integracoes/ utilizadores/ plano/ audit-logs/
├── admin/             super-admin: clientes, tickets, receita
├── onboarding/
└── api/               ~80 rotas

components/            ~97 componentes: admin, banco, conciliacao, configuracoes,
                       dashboard, faturas, investidores, layout, projetos, pwa,
                       suporte, ui (shadcn)

lib/
├── api/               auth.ts, admin-auth.ts (contexto + permissões)
├── banco/             statement-parser.ts (Excel/CSV/PDF + parser BPI)
├── banking/           tink.ts, salt-edge.ts (legado), reconciliation.ts
├── claude/            extract-invoice.ts, pick-expense-category.ts,
│                      reprocess-invoice.ts, generate-plan.ts, models.ts
├── efatura/           reconcile.ts
├── email/             gmail-imap.ts, process-email.ts, extract-attachments.ts, sync.ts
├── google/            drive.ts (OAuth + pastas + upload, por tenant)
├── integrations/      toconline.ts (API TOConline)
├── toconline/         token.ts, fc.ts, expense-categories.ts,
│                      assign-expense-category.ts   ← EXCLUSIVOS do modo direto
├── queries/           camada de leitura por domínio
├── stripe/ resend/ twilio/ supabase/ export/ webhooks/
└── utils/             audit, credits, encryption, permissions, portugal,
                       projects, invoice-status

supabase/migrations/   001 → 046
```

---

## 🗄️ Base de Dados

### Tabelas
`tenants`, `users`, `tenant_memberships`, `tenant_integrations`, `projects`,
`project_members`, `invoices`, `bank_transactions`, `reconciliations`,
`efatura_documents`, `toconline_expense_categories`, `monthly_snapshots`,
`investidores`, `projeto_investidores`, `subscriptions`, `credit_transactions`,
`support_tickets`, `support_messages`, `audit_logs`, `role_permissions`,
`email_processing_log`, `unmatched_emails`, `google_drive_integrations`,
`project_documents`, `project_tasks`

### Isolamento multi-tenant
RLS em todas as tabelas de dados, via helpers `SECURITY DEFINER`:
```sql
get_user_tenant_id()   -- tenant do utilizador autenticado
get_user_role()        -- role do utilizador autenticado
```
Política padrão: `USING (tenant_id = get_user_tenant_id())`.

### Estados da fatura (`invoices.status`)
```
pending · processing · em_sistema · necessita_revisao · enviada_erp
matched · reconciled · paid · rejected · duplicate
```
Transição para `enviada_erp` só a partir de `PRE_ERP_STATUSES`
(`pending`, `processing`, `em_sistema`, `necessita_revisao`) - ver
`lib/utils/invoice-status.ts`. Nunca pisar `rejected`/`paid`/`reconciled`.

### Histórico de migrações (001 → 046)
| Bloco | Conteúdo |
|---|---|
| 001-013 | Schema base: tenants, users, integrações, projetos, faturas, banco, conciliações, créditos, suporte, audit, permissões, RLS |
| 014-018 | Endurecimento de segurança, helpers RLS, trigger de novo utilizador |
| 019-021 | Realtime no suporte, `external_id` único e enriquecimento de movimentos |
| 022 | Email inbound (Gmail IMAP) com 3 níveis anti-duplicação |
| 023-026 | TOConline: índices, cache de receita, `toconline_fc_id` |
| 027 | `efatura_documents` (documentos da AT via TOConline) |
| 028 | Estados de fatura alargados |
| 029-030 | RPC e-Fatura, regime de IVA do tenant |
| 031-034 | Envio automático ao ERP, lock de sync de email, ciclo de faturação, tentativas de IA |
| 035-036 | Investidores + perfil |
| 037 | **Modo direto TOConline** (`integration_mode`, credenciais OAuth) |
| 038 | Snapshots de gastos + `tenant_memberships` (multi-tenant) |
| 039 | Notas por movimento bancário |
| 040 | **Categorias de gasto** (`toconline_expense_categories` + `invoices.expense_category_code`) |
| 041-043 | **Google Drive por tenant** + documentos de projeto. `projects.drive_folder_id` e índice **único** em `projects(tenant_id, name)` |
| 044-046 | **Planeamento**: `project_tasks`, fase (`phase`/`phase_order`), hierarquia (`parent_id`) e `progress` |

**Produção está na 046** (aplicadas 2026-07-22). Antes de qualquer deploy que
leia colunas novas, confirmar o schema de prod por `information_schema` - não
assumir pelo repositório.

---

## 🔒 Roles e Permissões

| Role | Âmbito |
|---|---|
| `super_admin` | ISONIQ TECH. Todos os tenants, tickets, receita. Identificado por `SUPER_ADMIN_USER_ID` |
| `owner` | Dono do tenant. Tudo, incluindo integrações e subscrição |
| `admin` | Gestor. Tudo exceto integrações e billing |
| `accountant` | Contabilista. Vê faturas, banco, conciliação, exporta |
| `member` | Funcionário. Só as faturas que enviou e os projetos atribuídos |
| `investidor` | Só os projetos onde participa, com relatórios próprios |

Verificação sempre via `hasPermission(role, recurso, acao)` (`lib/utils/permissions.ts`).
`tenant_memberships` permite um utilizador pertencer a vários tenants
(troca via `/api/auth/switch-tenant`).

---

## 🚀 Funcionalidades Implementadas

### 1. Entrada de faturas
- **Upload manual** (`/faturas/nova`) - PDF/JPG/PNG para Supabase Storage
- **Email (Gmail IMAP por tenant)** - `lib/email/` + cron 3x/dia. Anti-duplicação em
  3 níveis: `email_message_id`, hash do ficheiro, dados da fatura. Anexos extraídos
  e processados; emails sem anexo válido vão para `unmatched_emails`
- **WhatsApp** (Twilio) - `/api/webhooks/whatsapp`, com validação de assinatura
- **Import de compras do TOConline** - `/api/faturas/import-purchases`

### 2. Extração com IA
- `lib/claude/extract-invoice.ts` - devolve JSON estruturado (fornecedor, NIF,
  número, datas, valores, IVA, categoria, linhas, `confidence`, `needs_review`)
- **Chave e modelo Anthropic configuráveis por tenant** (`tenant_integrations`
  `type='ai'`, `provider='anthropic'`), com fallback para a chave da plataforma
- **Retry controlado**: `ai_attempts` / `ai_last_attempt_at` + cron `reprocess-failed`
- `confidence < 0.7` → `needs_review` e banner âmbar no detalhe da fatura

### 3. Projetos e obras
- CRUD, orçamento com alerta de limiar, membros, relatórios
- **Matching automático** de fatura → projeto por nome e `name_aliases`
- Lista em **grelha ou lista** (`?vista=lista`), com os filtros preservados
- O detalhe tem **3 tabs** por `?tab=`: Dashboard (o conteúdo original),
  Documentação e Planeamento - ver 12 e 13

### 4. Banco
- **Tink (Open Banking)**: ligação, sync de movimentos, callback
- **Import de extratos** (`/api/banco/import-statement`): Excel, CSV e PDF
  - Parser genérico com deteção de colunas (CGD, Crédito Agrícola, etc.)
  - **Parser dedicado BPI** (`isBpiStatement`): o extrato BPI é colunar (o `unpdf`
    extrai descrições, saldos, datas e valores em blocos separados) e usa datas
    `DD/MM` **sem ano**. Reconstrói por posição, infere o ano do período, aceita
    milhares por espaço ou ponto, e **auto-valida pela cadeia de saldos**
    (`saldo[i] = saldo[i-1] + valor[i]`). Se não reconciliar, **recusa** a importação
- **Notas por movimento**, que viajam para o campo `notes` do FC no TOConline

### 5. Conciliação
- Split view fatura ↔ movimento, automática e manual
- Estados `matched` / `reconciled`

### 6. e-Fatura (AT via TOConline)
- Tab dedicada em `/faturas` com filtros por estado AT e exportação (CSV/XLSX/PDF)
- **"Atualizar"**: mês atual + anterior. **"Importar histórico"**: janeiro → mês atual
  do ano corrente (a rota aceita `{months}`, 1..24; sem body faz 2 meses)
- Reconciliação `efatura_documents` ↔ `invoices`, marcando `at_communicated`
- Distingue documentos **novos** de **já existentes** no toast do resultado

### 7. ERP - TOConline (arquitetura "proxy fino")
Dois modos por tenant (`tenants.integration_mode`), mas com **TODA a lógica na app**.
A diferença entre modos colapsou para o **transporte HTTP**, via
`lib/toconline/transport.ts` (`tocRequest(tenantId, {base:"app"|"api", method, path,
query, body, contentType})`):
- **`toconline_direct`** (Revive): `getValidToken` + fetch a `app{N}`/`api{N}.toconline.pt`.
- **`n8n`** (FINMED): POST a um **proxy n8n genérico** (`config.proxy_url` da
  integração ERP do tenant; fallback env `N8N_TOCONLINE_PROXY_URL`), que só resolve
  o token e devolve a resposta CRUA `{status, body}`. **Um único workflow n8n** (o
  proxy) - já não há workflows por fluxo.

**O proxy n8n** (webhook único): valida `X-ISOFlow-Secret` (=`CRON_SECRET`) **e** o
`tenant_id` (fail-safe: recusa quem não for o tenant dele), resolve o token, monta o
URL `app{N}`/`api{N}` + query (encodeURIComponent), faz a chamada e responde
`{status, body}`. Body em **Raw** com Content-Type dinâmico (json / `vnd.api+json`)
para suportar escritas. Cada tenant n8n tem o **seu** n8n e o **seu** `proxy_url`.

Toda a leitura/escrita TOConline vive em `lib/`, partilhada pelos dois modos:
- Leitura: `fetchDocumentAssociations` (e-Fatura), `fetchDocsNetByDate`/`fetchAllV1Docs`
  (receita/gastos, paginado v1), `expense-categories` (catálogo).
- Escrita: `fc.ts` (`createFC`), `ncf.ts` (`createNCF`) - dedup → fornecedor
  (procura/**cria** via `/api/suppliers` + `vnd.api+json`) → cria documento →
  devolve o número. `send-fc.ts` (`sendInvoiceToERP`) é o ponto único de envio
  (send-erp, resend-erp, auto-envio, email).

Criação de FC (`/api/faturas/create-fc`): dedup → fornecedor → cria FC → grava
`toconline_fc_id`, `erp_synced` e promove para `enviada_erp`. Idempotente (dedup +
JA000). O callback `/api/faturas/[id]/update-fc` já **não é usado** no caminho novo
(a app cria e recebe o número na hora), mas fica ativo até o wf antigo ser desativado.

**Auto-envio ao ERP**: só acontece com a flag `tenants.auto_erp_send` **ligada** (e
fatura sem revisão). Com ela desligada, a FC cria-se **à mão**. Não há mais nenhum
forward incondicional na criação. O FINMED tem a flag **OFF**.

### 8. Categoria de gasto (conta SNC da linha da FC)
- Catálogo por tenant em `toconline_expense_categories` (código, descrição, IVA)
  - **os dois modos** buscam o catálogo síncrono ao TOConline via `tocRequest`
    (`/api/expense_categories`), refresca se > 24h. (O modo n8n já **não** dispara
    workflow nem espera push; `/api/webhooks/categorias` ficou redundante.)
- **A IA escolhe** a categoria quando a fatura é aberta pela primeira vez
  (`lib/claude/pick-expense-category.ts`), validando que o código existe no catálogo
- **Editável no detalhe da fatura**, e **bloqueada** depois de ir para o ERP
  (validado no servidor: o PATCH devolve 409)
- No modo n8n viaja no payload como `item_code` + `item_description`

### 9. Investidores
- Convite, perfil, associação a projetos, relatórios próprios, acesso restrito

### 10. Suporte
- Tickets com chat em tempo real (Supabase Realtime), anexos, aviso por email ao
  super-admin (Resend)

### 11. Admin (ISONIQ TECH)
- Clientes, criação de tenants, créditos, tickets, receita

### 12. Documentação de projeto (Google Drive)
- **Um Drive por tenant**, não da plataforma: cada empresa liga o **seu** Google
  por OAuth em Definições → Integrações. Tokens cifrados em
  `google_drive_integrations`, um registo por tenant, e **todas** as chamadas ao
  Drive são server-side
- Scope mínimo `drive.file`: a app só vê ficheiros que ela própria criou
- Pasta raiz `Projetos Flow` → subpasta por projeto (`projects.drive_folder_id`),
  criada de forma **lazy** no primeiro upload
- `project_documents` guarda só metadados; os bytes ficam no Drive. Visibilidade
  `interna` vs `investidores` (rótulo na UI: "Documentos partilhados")
- O `redirect_uri` deriva do host do pedido - senão test e prod colidiam

### 13. Planeamento de projeto (Gantt)
- `project_tasks` com **três níveis**: fase (`phase`, texto + `phase_order`) >
  tarefa macro > subtarefa (`parent_id`). A fase **não é uma linha na DB**: é
  agrupamento por nome, e a barra dela é agregada das tarefas
- Gantt próprio (`components/projetos/project-gantt.tsx`): escala em **px por
  dia** (não percentagem), zoom Dia/Semana/Mês, grelha com fins de semana,
  linha do dia atual, `progress` 0-100 desenhado dentro da barra
- **Geração com IA** (`lib/claude/generate-plan.ts`), por voz (Web Speech API,
  pt-PT) ou texto, com a chave/modelo do tenant
- A geração **só acrescenta, nunca substitui** - não há caminho, nem por API,
  que apague um cronograma inteiro. A IA recebe as fases e títulos existentes
  para não repetir, e as fases novas entram **a seguir** à maior `phase_order`
- Investidor: leitura, e só tarefas `visibility='todos'`

---

## 🔌 TOConline - Conhecimento Crítico

Endpoints em **duas bases**: `app{N}.toconline.pt` (app) e `api{N}.toconline.pt` (API v1).
Qual usar **não é previsível** - confirmar sempre.

| Fim | Endpoint |
|---|---|
| OAuth | `{appBase}/oauth/auth`, `{appBase}/oauth/token` |
| e-Fatura | `{appBase}/api/document_associations` |
| Dedup de FC | `{appBase}/api/commercial_purchases_documents_list_for_invoices` |
| Procurar fornecedor | `{appBase}/api/suppliers_moac` |
| **Criar fornecedor** | `{apiBase}/api/suppliers` |
| Criar FC | `{apiBase}/api/v1/commercial_purchases_documents` |
| Categorias de gasto | `{appBase}/api/expense_categories` |
| Impostos | `{appBase}/api/taxes` |

Documentação oficial: https://api-docs.toconline.pt

### Gotchas (todos custaram horas a descobrir)
1. **Encoding do filtro**: usar `encodeURIComponent` (espaços → `%20`), construindo o
   URL à mão. **NUNCA `URLSearchParams`** - codifica espaços como `+` e o TOConline
   devolve `400 code 42601` (syntax error SQL).
2. **Criar fornecedor**: caminho é `/api/suppliers` (**não** `/api/v1/suppliers`, que dá
   `404 FORBIDDEN_BY_GATEKEEPER`), `Content-Type: application/vnd.api+json`, body
   **JSON:API** `{data:{type:"suppliers",attributes:{tax_registration_number:<numérico>,business_name}}}`.
3. **Re-auth OAuth**: o code vem por **redirect** (`?code=...`), não no corpo HTML.
   Procurar em `authRes.url` primeiro.
4. **Respostas**: `data` pode vir como **string JSON aninhada** - fazer `JSON.parse`.
5. **Nomes de campos** do `document_associations`: `document_identifier`,
   `business_name`, `tax_registration_number`, `gross_total`, `status`
   (e **não** document_number/supplier_name/total/at_status).
6. **`tax_code`** deriva do IVA da fatura: `NOR`=23, `INT`=13, `RED`=6, `ISE`=0.
   Nunca fixar "NOR".
7. **`item_code`** das linhas da FC é o `accounting_number` de uma categoria de gasto,
   e varia por empresa. Nunca hardcoded.

### Token OAuth (modo direto) - `lib/toconline/token.ts`
- Access token vive ~4h. O caminho fiável de renovação é o **re-auth server-side**
  (GET `/oauth/auth` com Bearer **ainda válido** → code → `authorization_code`).
- Renova **20 min antes** de expirar, com cron `*/15`. O re-auth exige token vivo,
  por isso não se pode esperar pela expiração.
- Falhas gravam `sync_error` + `audit_logs` com o erro **real** no campo `detail`.
- Recuperação quando morre: refazer o OAuth nas Definições (**não** precisa de
  client_id/secret novos - esses são da app OAuth e não expiram).

---

## ⏰ Cron Jobs (vercel.json)

| Rota | Horário | Função |
|---|---|---|
| `/api/cron/email` | 08:00, 13:00, 19:00 | Sync de email inbound |
| `/api/cron/reprocess-failed` | 08:30, 13:30, 19:30 | Retry da extração IA |
| `/api/cron/sync-revenue` | 00:05 | Snapshots **receita + gastos**, os dois modos (via `runSnapshotSync`) |
| `/api/cron/efatura` | 08:00 dia 1 | Sync de e-Fatura, os dois modos (substitui o Schedule do wf n8n) |
| `/api/cron/refresh-tokens` | **`*/15`** | Renovação do token TOConline (modo direto) |

Autenticação: header `Authorization: Bearer <CRON_SECRET>`. Os crons percorrem
**todos** os tenants ERP (direto + n8n) e usam `tocRequest`.

---

## 🔗 Webhooks recebidos (do n8n) - **maioria REDUNDANTE** após o proxy

Com a conversão para proxy fino, o n8n deixou de fazer push. Estas rotas ainda
existem mas **já não são alimentadas** (retirar num cleanup; não construir sobre elas):

| Rota | Estado |
|---|---|
| `/api/efatura/sync` | redundante (e-Fatura agora lida via `tocRequest`) |
| `/api/webhooks/receita` | redundante (`runSnapshotSync` calcula) |
| `/api/webhooks/gastos` | redundante (`runSnapshotSync` calcula) |
| `/api/webhooks/categorias` | redundante (catálogo lido via `tocRequest`) |
| `/api/faturas/[id]/update-fc` | redundante no caminho novo (a app cria e recebe o nº na hora) |

Header `X-ISOFlow-Secret` (=`CRON_SECRET`). **O único webhook n8n ativo é o proxy
genérico** (`config.proxy_url`), que a app **chama** (não recebe push).

---

## 🎨 Design System - FINMED x Isoniq

Temas (next-themes, `attribute="class"`): `finmed-light` (**default**), `finmed-dark`,
`light`, `dark`, `studio`, `studio-dark`. `enableSystem={false}`.

### Tokens de marca (só nos blocos `.finmed-*` do globals.css)
```
--forest:#344E0D  --forest-deep:#223608  --forest-lt:#4E7217
--lime:#90C765    --mint:#62C099         --teal:#3DAEAF
--petrol:#1D8192  --abyss:#0D4961
--spectrum: linear-gradient(100deg,#90C765,#62C099 38%,#3DAEAF 70%,#1D8192)
```

**Regra absoluta:** componentes consomem SEMPRE tokens semânticos (`--background`,
`--foreground`, `--primary`), NUNCA hex direto.

### Parcimónia do gradiente
`--spectrum` / `.spectrum-text` APENAS em: 1 palavra do h1, botão CTA primário,
linha divisória decorativa, glow do product shot. Nunca em parágrafo, label,
ícone ou card inteiro.

### Tipografia
- **Display:** Space Grotesk → `font-display`. Títulos: `font-semibold tracking-[-0.03em]`
- **Body:** Inter → `font-sans`. Sentence case. Pesos 400/500/600

### Movimento
`animate-in fade-in slide-in-from-bottom-4`, hover `-translate-y-0.5`, sempre com
`motion-reduce:animate-none`.

### Padrões reutilizáveis (usar SEMPRE em vez de recriar à mão)

| Padrão | Onde | Para quê |
|---|---|---|
| `<SegmentedTabs>` | `components/ui/segmented-tabs.tsx` | Tabs de página. Fundo `bg-muted`, tab activa levantada em `bg-card` com sombra. Navega por `searchParams`, mantém Server Components e dá URL própria a cada tab |
| `<SectionHeader>` | `components/ui/section-header.tsx` | Cabeçalho de subsecção. Barra `bg-muted` com contador em `bg-primary` |
| `.surface-card` | `globals.css` (`@layer components`) | Cartão de conteúdo: borda, gradiente subtil sobre `--card` e `--shadow-card`. A mesma linguagem dos `KpiCard`. Juntar `.surface-card-hover` para realce |
| `.surface-empty` | `globals.css` | Estado vazio ou acção "adicionar": tracejado ao nível da página (`--background`), **sem** elevação. Contrasta de propósito com `.surface-card` |

Regra de ouro do contraste: **conteúdo existente = elevado** (`.surface-card`),
**espaço por preencher = ao nível da página** (`.surface-empty`). É isso que
distingue de relance o que já lá está do que falta.

Se precisares de um destes padrões noutro sítio, **importa o componente ou usa a
classe**. Não voltar a escrever o gradiente e a sombra à mão: foi assim que
apareceram inconsistências entre tabs.

### Branding por tenant
Bucket público `tenant-assets`, path `{tenant_id}/logo.{ext}`. `logo_url`,
`primary_color` e `app_name` na tabela `tenants`.

---

## 🇵🇹 Utilitários Portugal (`lib/utils/portugal.ts`)
```typescript
validateNIF(nif)                    // algoritmo de check digit
VAT_RATES = { normal: 23, intermediate: 13, reduced: 6, exempt: 0 }
formatCurrency(v)                   // Intl pt-PT EUR
formatDate(d)                       // Intl pt-PT
```

---

## ⚠️ Regras Absolutas de Desenvolvimento

### Caminho n8n (FINMED) - já convertido para proxy fino (2026-07)
> Nota histórica: **o n8n do FINMED deixou de ter workflows por fluxo.** Os 5
> workflows (e-Fatura, gastos, receita, categorias, criar FC/NCF) foram
> substituídos por **um proxy genérico**. Toda a lógica vive na app (ver Secção 7).
> A antiga regra "não tocar no bloco n8n do create-fc" **já não se aplica** - esse
> bloco foi removido; os dois modos usam `createFC`/`createNCF` via `tocRequest`.

Regras que se mantêm:
- **`tocRequest` é o único ponto de contacto com o TOConline.** Ao adicionar uma
  chamada nova, usá-lo (nunca `fetch` direto ao TOConline) - serve os dois modos.
- **Testar sempre no FINMED (n8n) E no Revive (direto)** - o FINMED só existe em
  prod, por isso a validação é em prod, de forma aditiva (caminho novo em paralelo,
  antigo desativado só após validar).
- O **proxy** só faz query+devolve raw. Nenhuma lógica de negócio no n8n.
- Cada tenant n8n tem o **seu** `config.proxy_url` (nunca partilhar um proxy entre
  tenants - o guard de `tenant_id` no proxy protege disto).

### Lição transversal
Vários bugs vieram de código escrito **só a pensar no FINMED** e exposto depois pela
Revive: fornecedor inexistente, `tax_code` fixo, `item_code` fixo, `resend-erp` só
para n8n. Ao tocar em qualquer caminho ERP, perguntar sempre: **funciona nos dois modos?**

### Trabalhar com a IA (Claude API)
- **Dar sempre a data de hoje no prompt.** Sem ela o modelo data pelo ano do
  treino: um cronograma gerado em 2026 saiu todo em 2025.
- **Não confiar no formato.** Parse defensivo (limpar fences, apanhar o array) e
  normalizar campo a campo, descartando o que não presta.
- **Contar com a saída maior do que se pensa.** Ao acrescentar subtarefas, os
  4000 `max_tokens` truncavam o JSON a meio.
- **Ao acrescentar, dizer-lhe o que já existe**, senão repete o que lá está.

### Ações destrutivas
Não expor botões que apagam em bloco quando o utilizador pode ter trabalho
manual investido. O "voltar a gerar / substituir todas" do planeamento foi
removido, e o campo saiu **também do schema da rota** - esconder na UI não
chega. Apagar continua possível, item a item e com confirmação.

### Segurança
1. NUNCA query sem filtro `tenant_id`
2. SEMPRE validar assinatura de webhooks
3. SEMPRE encriptar chaves externas (`lib/utils/encryption.ts`)
4. NUNCA expor `SUPABASE_SERVICE_ROLE_KEY` no cliente
5. NUNCA logar NIF, IBAN, credenciais ou tokens
6. Validar TODOS os inputs com Zod
7. Regras de negócio validadas **no servidor**, não só na UI
   (ex.: categoria bloqueada após envio ao ERP devolve 409)

### Código
8. TypeScript strict - ZERO `any`, ZERO `ts-ignore`
9. SEMPRE try/catch em chamadas externas
10. SEMPRE loading states e feedback (toast)
11. Server Components por defeito
12. Correr `npx tsc --noEmit` **e** `npx next build` antes de commit
    (o `next build` é mais estrito que o `tsc`)
13. Tabelas novas ainda não estão em `types/supabase.ts`: usar
    `createAdminClient() as unknown as SupabaseClient` com comentário

### Diagnóstico
14. Os logs runtime do Vercel **não mostram** `console.log`. Diagnosticar criando
    uma **rota temporária** que devolve a resposta crua do serviço externo em JSON
    (guardada a super-admin), e **removê-la** depois. Foi assim que se resolveram
    o e-Fatura, o token OAuth e a criação de FC.
15. Instrumentar erros: guardar a mensagem **real** do serviço externo
    (ex.: `audit_logs.metadata.detail`), nunca só uma mensagem genérica.
16. Não assumir a causa. Confirmar com dados antes de corrigir.
17. `jsonError(msg, status, details)` põe o erro real em **`details`**. O cliente
    tem de mostrar os dois - mostrar só `error` dá "Database error" e não diz nada.
    É o mesmo princípio do ponto 15, do lado da UI.

### Compliance e performance
17. Dados apenas em região europeia (RGPD)
18. Audit log em todas as ações importantes
19. Índices em `tenant_id` + datas; paginação máx. 50 registos
20. Ficheiros via CDN Supabase Storage; uploads não bloqueiam a UI

---

## 🌍 Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude (extração + escolha de categoria). Pode ser sobreposta por tenant.
ANTHROPIC_API_KEY=

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# Resend (email transacional)
RESEND_API_KEY=
RESEND_FROM=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_BUSINESS_PRICE_ID=
STRIPE_PRO_PRICE_ID=

# Tink (Open Banking)
TINK_CLIENT_ID=
TINK_CLIENT_SECRET=
TINK_WEBHOOK_SECRET=

# Gmail (inbound por tenant)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=

# Google Drive (documentos de projeto). App OAuth da plataforma; cada tenant
# liga a SUA conta Google e os ficheiros ficam no Drive dele.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# n8n. O proxy fino usa config.proxy_url por tenant; a env abaixo é só fallback.
N8N_TOCONLINE_PROXY_URL=          # fallback do proxy TOConline (por tenant: config.proxy_url)
# Legado (redundante após o proxy - já não são usadas no caminho novo):
N8N_WEBHOOK_URL=                  # era o webhook de FC
N8N_WEBHOOK_SECRET=
EFATURA_SYNC_WEBHOOK_URL=
N8N_EXPENSE_CATEGORIES_URL=

# App
NEXT_PUBLIC_APP_URL=
ADMIN_EMAIL=
ENCRYPTION_KEY=            # AES-256 hex (openssl rand -hex 32)
SUPER_ADMIN_USER_ID=
INVOICE_FILES_BUCKET=
CRON_SECRET=               # também usado no header X-ISOFlow-Secret
```

---

## 💳 Planos

```
starter    → 49€/mês  → 5 proj  → 3 bancos → 3 users  → 1 GB
business   → 89€/mês  → ilimit  → ilimit   → 15 users → 5 GB
investor   → 129€/mês → ilimit  → ilimit   → 50 users → 15 GB
enterprise → custom   → ilimit  → ilimit   → custom   → custom
```

Todos incluem: Email + WhatsApp, conciliação bancária, e-Fatura, integração ERP,
suporte por ticket. O `investor` adiciona suporte assistido; o `enterprise` inclui
SLA dedicado.

Nota: o campo `tenants.plan` aceita `'starter'|'business'|'pro'|'enterprise'`.
O id `'pro'` corresponde ao plano **Investor** na UI.
