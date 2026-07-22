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
│                      reprocess-invoice.ts, models.ts
├── efatura/           reconcile.ts
├── email/             gmail-imap.ts, process-email.ts, extract-attachments.ts, sync.ts
├── integrations/      toconline.ts (API TOConline)
├── toconline/         token.ts, fc.ts, expense-categories.ts,
│                      assign-expense-category.ts   ← EXCLUSIVOS do modo direto
├── queries/           camada de leitura por domínio
├── stripe/ resend/ twilio/ supabase/ export/ webhooks/
└── utils/             audit, credits, encryption, permissions, portugal,
                       projects, invoice-status

supabase/migrations/   001 → 040
```

---

## 🗄️ Base de Dados

### Tabelas
`tenants`, `users`, `tenant_memberships`, `tenant_integrations`, `projects`,
`project_members`, `invoices`, `bank_transactions`, `reconciliations`,
`efatura_documents`, `toconline_expense_categories`, `monthly_snapshots`,
`investidores`, `projeto_investidores`, `subscriptions`, `credit_transactions`,
`support_tickets`, `support_messages`, `audit_logs`, `role_permissions`,
`email_processing_log`, `unmatched_emails`

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

### Histórico de migrações (001 → 040)
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

### 7. ERP - TOConline
Dois modos por tenant (`tenants.integration_mode`), com **a mesma lógica de app**:
- **`toconline_direct`**: o ISOFlow fala diretamente com o TOConline (OAuth próprio)
- **`n8n`**: o ISOFlow envia o payload ao webhook n8n do cliente, que trata do resto

Criação de FC (`/api/faturas/create-fc`, trata os dois modos): dedup → fornecedor
(procura ou cria) → cria FC → grava `toconline_fc_id`, `erp_synced` e promove o
estado para `enviada_erp`. Faturas já lançadas são ignoradas (sem duplicados).

### 8. Categoria de gasto (conta SNC da linha da FC)
- Catálogo por tenant em `toconline_expense_categories` (código, descrição, IVA)
  - modo direto: o ISOFlow vai buscá-lo ao TOConline sozinho (refresca se > 24h)
  - modo n8n: o ISOFlow **dispara** o workflow do tenant, que empurra o catálogo
    para `/api/webhooks/categorias`. O tenant não agenda nada
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
| `/api/cron/sync-revenue` | 00:05 | Snapshot de receita |
| `/api/cron/refresh-tokens` | **`*/15`** | Renovação do token TOConline |

Autenticação: header `Authorization: Bearer <CRON_SECRET>`.

---

## 🔗 Webhooks recebidos (do n8n)

Todos com header `X-ISOFlow-Secret` validado contra `CRON_SECRET`:

| Rota | Payload |
|---|---|
| `/api/efatura/sync` | documentos e-Fatura |
| `/api/webhooks/receita` | receita mensal |
| `/api/webhooks/gastos` | gastos mensais |
| `/api/webhooks/categorias` | catálogo de categorias de gasto |
| `/api/faturas/[id]/update-fc` | número da FC criada |

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

### Caminho n8n (FINMED) - INTOCÁVEL
- **NUNCA** modificar a lógica do bloco n8n em `app/api/faturas/create-fc/route.ts`
- **NUNCA** alterar `/api/efatura/sync` nem os webhooks existentes
- `lib/toconline/token.ts` e `fc.ts` são **exclusivos do modo direto**
- Campos novos no payload do n8n são sempre **aditivos** (o workflow antigo ignora-os)
- Ao adicionar suporte a um caso novo, criar caminho **detetado e isolado**
  (como `isBpiStatement`), nunca alterar o parser partilhado

### Lição transversal
Vários bugs vieram de código escrito **só a pensar no FINMED** e exposto depois pela
Revive: fornecedor inexistente, `tax_code` fixo, `item_code` fixo, `resend-erp` só
para n8n. Ao tocar em qualquer caminho ERP, perguntar sempre: **funciona nos dois modos?**

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

# n8n
N8N_WEBHOOK_URL=
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
