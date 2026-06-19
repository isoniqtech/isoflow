# CLAUDE.md - ISOFlow by ISONIQ TECH

---

## ⛔ REGRA DE SCHEMA (INQUEBRÁVEL)

**NUNCA alterar o schema de produção à mão pelo dashboard Supabase.**

Toda a alteração de schema é uma migration em `supabase/migrations/`, aplicada **primeiro ao DEV** e só depois ao **PROD via merge em `main`** (o GitHub Action `deploy-migrations.yml` faz o push automático).

Fluxo obrigatório:
1. `git checkout -b feat/minha-feature`
2. `npm run db:diff -- nome_da_migration` → gera ficheiro em `supabase/migrations/`
3. `supabase link --project-ref <DEV_REF> && npm run db:push` → testa no DEV
4. PR → review → merge em `main` → GitHub Action aplica ao PROD automaticamente

---

## LEITURA OBRIGATÓRIA
Lê este ficheiro COMPLETO antes de escrever qualquer linha de código.
Lê também PRD.md, TECH.md e TASKS.md antes de começar qualquer tarefa.

## ✍️ Regras de Escrita
- **NUNCA usar travessão longo (-) em nenhum texto, label, título ou comentário de código.**
  Usar hífen (-) ou reescrever a frase sem travessão.

---

## 🎯 O Produto

**ISOFlow** é uma plataforma SaaS multi-tenant portuguesa para gestão
automática de faturas, conciliação bancária e controlo de projetos/obras.
Desenvolvida pela ISONIQ TECH (isoniqtech.com).

### Proposta de valor:
- Recebe faturas via WhatsApp e Email automaticamente
- Lê e extrai dados com IA (Claude API)
- Organiza por projetos / obras / centros de custo
- Concilia faturas com movimentos bancários
- Integra com ERPs portugueses
- Vendida como SaaS com subscrição mensal

---

## 🌐 Ambientes - LEITURA OBRIGATÓRIA ANTES DE TOCAR NA DB

Existem **dois ambientes completamente separados**. NUNCA confundir.

| | Preview (Dev) | Produção |
|---|---|---|
| **URL** | test.isoniqtech.com | flow.isoniqtech.com |
| **Branch Git** | develop | main |
| **Supabase Org** | isoflow DEV | Isoniq Tech |
| **Supabase Projeto** | isoflow dev | isoflow |
| **Vercel Target** | preview | production |

### Sequência obrigatória de trabalho:
1. **Local** - desenvolver e testar em localhost
2. **GitHub `develop`** - commit + push → Vercel faz deploy automático para test.isoniqtech.com → validar
3. **GitHub `main`** - só após validação completa em dev, merge/PR develop→main → Vercel faz deploy para flow.isoniqtech.com

GitHub: https://github.com/isoniqtech/isoflow (controlo de versões obrigatório em todos os passos)

### Regras absolutas de ambiente:
- NUNCA saltar passos - local → dev → prod, sempre por esta ordem
- O MCP Supabase está ligado ao projeto de **PRODUÇÃO** - nunca aplicar migrações via MCP sem confirmação explícita do utilizador
- Migrações em **dev**: instruir o utilizador a correr no Supabase dashboard → org "isoflow DEV" → projeto "isoflow dev" → SQL Editor
- Migrações em **produção**: só após validação em dev, com confirmação explícita

---

## 🏗️ Stack Técnica

| Camada | Tecnologia | Notas |
|---|---|---|
| Framework | Next.js 14+ App Router | Server + Client Components |
| Base de dados | Supabase (PostgreSQL) | Auth + DB + Storage |
| Auth | Supabase Auth | JWT, sessões, convites |
| Storage | Supabase Storage | PDFs e imagens faturas |
| IA | Claude API claude-sonnet-4-20250514 | Extração faturas |
| WhatsApp | Twilio WhatsApp Business API | Webhook inbound |
| Email | Resend inbound + webhooks | Email inbound |
| Open Banking | Salt Edge API | Movimentos bancários PT |
| Pagamentos | Stripe subscriptions | Planos + créditos |
| Deploy | Vercel | CI/CD automático |
| Linguagem | TypeScript strict | Sem any, sem ts-ignore |
| Estilos | Tailwind CSS | Utility-first |
| Componentes | shadcn/ui | Design system |
| Ícones | Lucide React | |
| Formulários | React Hook Form + Zod | Validação client+server |
| Tabelas | TanStack Table v8 | |
| Datas | date-fns | |
| Toasts | Sonner | |

---

## 📁 Estrutura de Pastas

isoflow/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Dashboard KPIs
│   │   ├── faturas/
│   │   │   ├── page.tsx                  # Lista faturas
│   │   │   ├── nova/page.tsx             # Upload manual
│   │   │   └── [id]/page.tsx             # Detalhe + PDF viewer
│   │   ├── projetos/
│   │   │   ├── page.tsx                  # Lista projetos
│   │   │   ├── novo/page.tsx             # Criar projeto
│   │   │   └── [id]/
│   │   │       ├── page.tsx              # Detalhe + faturas
│   │   │       └── relatorio/page.tsx    # Relatório PDF
│   │   ├── conciliacao/
│   │   │   └── page.tsx                  # Split view
│   │   ├── banco/
│   │   │   └── page.tsx                  # Movimentos
│   │   ├── suporte/
│   │   │   ├── page.tsx                  # Lista tickets
│   │   │   └── [id]/page.tsx             # Chat ticket
│   │   └── configuracoes/
│   │       ├── page.tsx                  # Empresa + branding
│   │       ├── integracoes/page.tsx      # ERP, banco, WhatsApp
│   │       ├── utilizadores/page.tsx     # Equipa + roles
│   │       └── plano/page.tsx            # Subscrição + créditos
│   │
│   ├── (admin)/                          # Super-admin ISONIQ TECH
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Overview geral
│   │   ├── clientes/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── tickets/page.tsx
│   │   └── receita/page.tsx
│   │
│   ├── onboarding/
│   │   └── page.tsx                      # Wizard 3 passos
│   │
│   └── api/
│       ├── webhooks/
│       │   ├── whatsapp/route.ts
│       │   ├── email/route.ts
│       │   ├── banking/route.ts
│       │   └── stripe/route.ts
│       ├── faturas/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   └── process/route.ts
│       ├── projetos/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── banco/
│       │   ├── connect/route.ts
│       │   ├── transactions/route.ts
│       │   └── sync/route.ts
│       ├── conciliacao/
│       │   ├── auto/route.ts
│       │   └── manual/route.ts
│       ├── creditos/
│       │   ├── balance/route.ts
│       │   └── purchase/route.ts
│       ├── tickets/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── messages/route.ts
│       └── integracoes/
│           ├── toconline/route.ts
│           ├── primavera/route.ts
│           └── atura/route.ts
│
├── components/
│   ├── ui/                               # shadcn/ui gerado
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── mobile-nav.tsx
│   ├── dashboard/
│   │   ├── kpi-card.tsx
│   │   ├── recent-invoices.tsx
│   │   ├── alerts-panel.tsx
│   │   ├── budget-alerts.tsx
│   │   └── credits-widget.tsx
│   ├── faturas/
│   │   ├── invoice-table.tsx
│   │   ├── invoice-detail.tsx
│   │   ├── pdf-viewer.tsx
│   │   ├── upload-zone.tsx
│   │   ├── project-selector.tsx
│   │   └── status-badge.tsx1
│   ├── projetos/
│   │   ├── project-list.tsx
│   │   ├── project-card.tsx
│   │   ├── project-form.tsx
│   │   ├── budget-progress.tsx
│   │   └── project-invoices.tsx
│   ├── conciliacao/
│   │   ├── split-view.tsx
│   │   ├── bank-list.tsx
│   │   ├── invoice-list.tsx
│   │   └── match-card.tsx
│   ├── banco/
│   │   ├── transaction-table.tsx
│   │   └── bank-connect.tsx
│   ├── suporte/
│   │   ├── ticket-list.tsx
│   │   ├── ticket-form.tsx
│   │   └── ticket-chat.tsx
│   └── configuracoes/
│       ├── branding-upload.tsx
│       ├── integration-card.tsx
│       └── user-invite-form.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── claude/
│   │   └── extract-invoice.ts
│   ├── twilio/
│   │   ├── whatsapp.ts
│   │   └── validate.ts
│   ├── resend/
│   │   ├── inbound.ts
│   │   └── notifications.ts
│   ├── stripe/
│   │   ├── subscriptions.ts
│   │   ├── credits.ts
│   │   └── webhooks.ts
│   ├── banking/
│   │   ├── salt-edge.ts
│   │   └── reconciliation.ts
│   ├── integrations/
│   │   ├── toconline.ts
│   │   ├── primavera.ts
│   │   └── atura.ts
│   └── utils/
│       ├── credits.ts
│       ├── audit.ts
│       ├── encryption.ts
│       ├── permissions.ts
│       ├── projects.ts
│       └── portugal.ts
│
├── types/
│   ├── index.ts
│   └── supabase.ts                       # Gerado pelo Supabase CLI
│
├── hooks/
│   ├── use-tenant.ts
│   ├── use-credits.ts
│   ├── use-permissions.ts
│   ├── use-invoices.ts
│   ├── use-projects.ts
│   └── use-bank-transactions.ts
│
├── middleware.ts
│
└── supabase/
└── migrations/
├── 001_tenants.sql
├── 002_users.sql
├── 003_integrations.sql
├── 004_projects.sql
├── 005_project_members.sql
├── 006_invoices.sql
├── 007_bank_transactions.sql
├── 008_reconciliations.sql
├── 009_credits.sql
├── 010_support.sql
├── 011_audit_logs.sql
├── 012_role_permissions.sql
└── 013_rls_policies.sql

---

## 🗄️ Schema Completo

```sql-- =============================================
-- MIGRATION 001 - TENANTS
-- =============================================
CREATE TABLE tenants (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name text NOT NULL,
nif text UNIQUE,
email text,
phone text,
address text,
plan text DEFAULT 'starter'
CHECK (plan IN ('starter','business','pro','enterprise')),
credits_balance integer DEFAULT 0,
credits_used_this_month integer DEFAULT 0,
stripe_customer_id text UNIQUE,
stripe_subscription_id text UNIQUE,
status text DEFAULT 'trial'
CHECK (status IN ('trial','active','suspended','cancelled')),
trial_ends_at timestamptz DEFAULT now() + interval '14 days',
onboarding_completed boolean DEFAULT false,
-- Branding
logo_path text,
logo_url text,
favicon_path text,
primary_color text DEFAULT '#2563EB',
app_name text DEFAULT 'ISOFlow',
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
);-- =============================================
-- MIGRATION 002 - USERS
-- =============================================
CREATE TABLE users (
id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
name text NOT NULL,
email text NOT NULL,
role text DEFAULT 'member'
CHECK (role IN ('owner','admin','accountant','member')),
avatar_url text,
is_active boolean DEFAULT true,
last_login_at timestamptz,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
);CREATE INDEX idx_users_tenant ON users(tenant_id);-- =============================================
-- MIGRATION 003 - TENANT INTEGRATIONS
-- =============================================
CREATE TABLE tenant_integrations (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
type text NOT NULL
CHECK (type IN ('erp','banking','whatsapp','email')),
provider text NOT NULL,
api_key_encrypted text,
api_secret_encrypted text,
config jsonb DEFAULT '{}',
is_active boolean DEFAULT true,
last_sync_at timestamptz,
sync_error text,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now(),
UNIQUE(tenant_id, type, provider)
);-- =============================================
-- MIGRATION 004 - PROJECTS
-- =============================================
CREATE TABLE projects (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
name text NOT NULL,
code text,
description text,
type text DEFAULT 'obra'
CHECK (type IN ('obra','projeto','departamento','cliente','outro')),
status text DEFAULT 'active'
CHECK (status IN ('active','completed','paused','cancelled')),
budget numeric(10,2),
budget_alert_threshold integer DEFAULT 80,
start_date date,
end_date date,
color text DEFAULT '#2563EB',
client_name text,
location text,
notes text,
name_aliases text[] DEFAULT '{}',
created_by uuid REFERENCES users(id),
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
);CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_status ON projects(tenant_id, status);-- =============================================
-- MIGRATION 005 - PROJECT MEMBERS
-- =============================================
CREATE TABLE project_members (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
created_at timestamptz DEFAULT now(),
UNIQUE(project_id, user_id)
);CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);-- =============================================
-- MIGRATION 006 - INVOICES
-- =============================================
CREATE TABLE invoices (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
external_id text,
type text NOT NULL DEFAULT 'incoming'
CHECK (type IN ('incoming','outgoing')),
status text DEFAULT 'pending'
CHECK (status IN ('pending','processing','matched',
'paid','rejected','duplicate')),
supplier_name text,
supplier_nif text,
supplier_email text,
supplier_address text,
invoice_number text,
invoice_date date,
due_date date,
subtotal numeric(10,2),
vat_rate numeric(5,2),
vat_amount numeric(10,2),
total numeric(10,2),
currency text DEFAULT 'EUR',
description text,
category text,
source text DEFAULT 'manual'
CHECK (source IN ('whatsapp','email','manual','api','erp')),
sent_by text,
sender_phone text,
sender_email text,
file_path text,
file_name text,
file_type text
CHECK (file_type IN ('pdf','jpg','jpeg','png')),
file_size_bytes integer,
bank_transaction_id uuid,
matched_at timestamptz,
matched_by text CHECK (matched_by IN ('auto','manual')),
match_score numeric(3,2),
ai_confidence numeric(3,2),
ai_raw_response jsonb,
ai_processed_at timestamptz,
needs_review boolean DEFAULT false,
erp_synced boolean DEFAULT false,
erp_synced_at timestamptz,
erp_document_id text,
at_communicated boolean DEFAULT false,
at_communicated_at timestamptz,
notes text,
tags text[],
created_by uuid REFERENCES users(id),
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
);CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_date ON invoices(tenant_id, invoice_date);
CREATE INDEX idx_invoices_supplier ON invoices(tenant_id, supplier_nif);-- =============================================
-- MIGRATION 007 - BANK TRANSACTIONS
-- =============================================
CREATE TABLE bank_transactions (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
account_id text NOT NULL,
account_name text,
bank_name text,
iban text,
external_id text,
date date NOT NULL,
value_date date,
amount numeric(10,2) NOT NULL,
currency text DEFAULT 'EUR',
description text,
type text CHECK (type IN ('debit','credit')),
category text,
mode text,
invoice_id uuid REFERENCES invoices(id),
matched_at timestamptz,
matched_by text CHECK (matched_by IN ('auto','manual')),
raw_data jsonb,
created_at timestamptz DEFAULT now()
);CREATE INDEX idx_bank_tenant ON bank_transactions(tenant_id);
CREATE INDEX idx_bank_date ON bank_transactions(tenant_id, date);
CREATE INDEX idx_bank_unmatched ON bank_transactions(tenant_id, invoice_id)
WHERE invoice_id IS NULL;-- =============================================
-- MIGRATION 008 - RECONCILIATIONS
-- =============================================
CREATE TABLE reconciliations (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
invoice_id uuid NOT NULL REFERENCES invoices(id),
bank_transaction_id uuid NOT NULL REFERENCES bank_transactions(id),
match_type text NOT NULL CHECK (match_type IN ('auto','manual')),
match_score numeric(3,2),
status text DEFAULT 'pending'
CHECK (status IN ('confirmed','pending','rejected')),
confirmed_by uuid REFERENCES users(id),
confirmed_at timestamptz,
rejected_by uuid REFERENCES users(id),
rejected_at timestamptz,
rejection_reason text,
created_at timestamptz DEFAULT now(),
UNIQUE(invoice_id, bank_transaction_id)
);-- =============================================
-- MIGRATION 009 - CREDITS
-- =============================================
CREATE TABLE subscriptions (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
plan text NOT NULL,
price_monthly numeric NOT NULL,
credits_monthly integer NOT NULL,
status text DEFAULT 'active'
CHECK (status IN ('active','cancelled','past_due','trialing')),
stripe_subscription_id text UNIQUE,
current_period_start timestamptz,
current_period_end timestamptz,
cancel_at_period_end boolean DEFAULT false,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
);CREATE TABLE credit_transactions (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
amount integer NOT NULL,
type text NOT NULL
CHECK (type IN ('purchase','usage','refund','bonus','monthly_reset')),
description text,
reference_id uuid,
reference_type text,
balance_after integer NOT NULL,
created_at timestamptz DEFAULT now()
);CREATE INDEX idx_credits_tenant ON credit_transactions(tenant_id);-- =============================================
-- MIGRATION 010 - SUPPORT
-- =============================================
CREATE TABLE support_tickets (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
created_by uuid NOT NULL REFERENCES users(id),
assigned_to uuid REFERENCES users(id),
title text NOT NULL,
description text NOT NULL,
status text DEFAULT 'open'
CHECK (status IN ('open','in_progress','waiting_client',
'resolved','closed')),
priority text DEFAULT 'medium'
CHECK (priority IN ('low','medium','high','urgent')),
category text
CHECK (category IN ('billing','technical','integration',
'invoice','banking','other')),
credits_charged integer DEFAULT 5,
first_response_at timestamptz,
resolved_at timestamptz,
satisfaction_rating integer CHECK (satisfaction_rating BETWEEN 1 AND 5),
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
);CREATE TABLE support_messages (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
sender_id uuid NOT NULL REFERENCES users(id),
sender_type text NOT NULL CHECK (sender_type IN ('client','support')),
message text NOT NULL,
attachments jsonb DEFAULT '[]',
is_internal boolean DEFAULT false,
created_at timestamptz DEFAULT now()
);-- =============================================
-- MIGRATION 011 - AUDIT LOGS
-- =============================================
CREATE TABLE audit_logs (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
user_id uuid REFERENCES users(id),
action text NOT NULL,
resource_type text,
resource_id uuid,
metadata jsonb DEFAULT '{}',
ip_address text,
user_agent text,
created_at timestamptz DEFAULT now()
);CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);-- =============================================
-- MIGRATION 012 - ROLE PERMISSIONS
-- =============================================
CREATE TABLE role_permissions (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
role text NOT NULL,
resource text NOT NULL,
can_view boolean DEFAULT false,
can_create boolean DEFAULT false,
can_edit boolean DEFAULT false,
can_delete boolean DEFAULT false,
UNIQUE(tenant_id, role, resource)
);-- =============================================
-- MIGRATION 013 - RLS POLICIES
-- =============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid AS $$
SELECT tenant_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;CREATE POLICY "isolation_projects" ON projects
USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_project_members" ON project_members
USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_invoices" ON invoices
USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_bank" ON bank_transactions
USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_reconciliations" ON reconciliations
USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_tickets" ON support_tickets
USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_messages" ON support_messages
USING (ticket_id IN (
SELECT id FROM support_tickets WHERE tenant_id = get_user_tenant_id()
));
CREATE POLICY "isolation_credits" ON credit_transactions
USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_integrations" ON tenant_integrations
USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_audit" ON audit_logs
USING (tenant_id = get_user_tenant_id());
CREATE POLICY "isolation_subscriptions" ON subscriptions
USING (tenant_id = get_user_tenant_id());

---

## 🔒 Roles e Permissõessuper_admin → proprietário da plataforma (ISONIQ TECH)

Acesso a todos os tenants
Responde a tickets
Gere receita e clientes
Identificado por SUPER_ADMIN_USER_ID no .env
owner → dono da empresa cliente

Acesso total ao seu tenant
Gere utilizadores, roles e projetos
Gere subscrição e pagamentos
Configura todas as integrações
admin → gestor da empresa

Tudo exceto gerir subscrição/pagamentos
Pode convidar utilizadores
Pode criar/editar/arquivar projetos
Não configura integrações bancárias
accountant → contabilista

Ver faturas, valores, conciliação
Exportar relatórios
Ver movimentos bancários
NÃO gere utilizadores nem configurações
member → funcionário

Enviar faturas (WhatsApp/email/upload)
Ver APENAS as faturas que enviou
Ver APENAS projetos a que foi atribuído
NÃO vê dados bancários
NÃO vê configurações


### Tabela de permissões por recursoRecursoowneradminaccountantmemberfaturas.view_all✅✅✅❌faturas.view_own✅✅✅✅faturas.create✅✅✅✅faturas.edit✅✅❌❌faturas.delete✅✅❌❌projetos.view_all✅✅✅❌projetos.view_own✅✅✅✅projetos.create✅✅❌❌projetos.edit✅✅❌❌projetos.delete✅❌❌❌banco.view✅✅✅❌conciliacao.view✅✅✅❌conciliacao.confirm✅✅✅❌relatorios.export✅✅✅❌utilizadores.manage✅✅❌❌configuracoes.view✅✅❌❌integracoes.manage✅❌❌❌billing.manage✅❌❌❌suporte.create✅✅✅✅

---

## 🤖 Extração de Faturas com Claude API

```typescript// lib/claude/extract-invoice.ts
import Anthropic from '@anthropic-ai/sdk'const client = new Anthropic()export const INVOICE_EXTRACTION_PROMPT = `
Analisa esta fatura e extrai os dados estruturados.
Responde APENAS com JSON válido. Sem texto. Sem markdown. Sem backticks.Schema obrigatório:
{
"supplier_name": string | null,
"supplier_nif": string | null,
"supplier_email": string | null,
"supplier_address": string | null,
"invoice_number": string | null,
"invoice_date": "YYYY-MM-DD" | null,
"due_date": "YYYY-MM-DD" | null,
"subtotal": number | null,
"vat_rate": number | null,
"vat_amount": number | null,
"total": number | null,
"currency": "EUR",
"description": string | null,
"category": "transporte"|"alimentacao"|"tecnologia"|"servicos"|
"material"|"combustivel"|"comunicacoes"|
"alojamento"|"formacao"|"outro",
"line_items": [{
"description": string,
"quantity": number,
"unit_price": number,
"vat_rate": number,
"total": number
}],
"confidence": number,
"needs_review": boolean,
"notes": string | null
}Regras estritas:

confidence: 0.0-1.0. Se < 0.7 definir needs_review: true
Todos os valores monetários são números, nunca strings
NIF português tem exatamente 9 dígitos
Se campo não visível → null
Se múltiplos IVAs → usar o predominante em vat_rate
`
export async function extractInvoiceData(
fileBase64: string,
fileType: 'pdf' | 'jpg' | 'jpeg' | 'png'
): Promise<InvoiceExtraction> {
const isImage = ['jpg', 'jpeg', 'png'].includes(fileType)
const mediaType = isImage
? image/${fileType === 'jpg' ? 'jpeg' : fileType}
: 'application/pdf'const response = await client.messages.create({
model: 'claude-sonnet-4-20250514',
max_tokens: 2000,
messages: [{
role: 'user',
content: [
{
type: isImage ? 'image' : 'document',
source: { type: 'base64', media_type: mediaType, data: fileBase64 },
} as any,
{ type: 'text', text: INVOICE_EXTRACTION_PROMPT },
],
}],
})const text = response.content
.filter(b => b.type === 'text')
.map(b => (b as any).text)
.join('')return JSON.parse(text.trim())
}

---

## 🏗️ Projetos - Matching Automático

```typescript// lib/utils/projects.tsexport async function matchProjectFromText(
text: string,
tenantId: string,
supabase: SupabaseClient
): Promise<string | null> {
const { data: projects } = await supabase
.from('projects')
.select('id, name, name_aliases')
.eq('tenant_id', tenantId)
.eq('status', 'active')if (!projects?.length) return nullconst normalized = text.toLowerCase().trim()for (const project of projects) {
if (normalized.includes(project.name.toLowerCase())) {
return project.id
}
for (const alias of (project.name_aliases ?? [])) {
if (normalized.includes(alias.toLowerCase())) {
return project.id
}
}
}
return null
}export async function checkBudgetAlert(
projectId: string,
tenantId: string,
supabase: SupabaseClient
) {
const { data: project } = await supabase
.from('projects')
.select('name, budget, budget_alert_threshold')
.eq('id', projectId)
.single()if (!project?.budget) returnconst { data } = await supabase
.from('invoices')
.select('total')
.eq('project_id', projectId)
.eq('tenant_id', tenantId)
.not('status', 'eq', 'rejected')const totalSpent = data?.reduce((sum, i) => sum + (i.total ?? 0), 0) ?? 0
const percentage = (totalSpent / project.budget) * 100if (percentage >= (project.budget_alert_threshold ?? 80)) {
await sendBudgetAlertEmail(project, percentage, totalSpent)
}
}

---

## 🎨 Branding por Tenant

```typescript// Supabase Storage bucket: tenant-assets (público)
// Path: {tenant_id}/logo.{ext}
// Path: {tenant_id}/favicon.ico// components/layout/sidebar.tsx
export function Sidebar() {
const { tenant } = useTenant()
return (
<aside>
<div className="logo-area">
{tenant?.logo_url
? <img src={tenant.logo_url} alt={tenant.name} className="h-8" />
: <ISOFlowLogo />
}
<span>{tenant?.app_name ?? 'ISOFlow'}</span>
</div>
</aside>
)
}// Cor primária aplicada via CSS variable
// Em layout.tsx do dashboard:
// style={{ '--primary': tenant.primary_color }}

---

## 💳 Planos e CréditosPLANOS:
starter    → 79€/mês  → 500 créditos  → 50 fat/mês  → 5 proj  → 1 banco  → 2 users
business   → 179€/mês → 1500 créditos → 200 fat/mês → 20 proj → 3 bancos → 5 users
pro        → 349€/mês → 5000 créditos → ilimitado   → ilimit  → ilimit   → 15 users
enterprise → 599€+/mês → custom       → ilimitado   → ilimit  → ilimit   → ilimitadoCUSTO POR AÇÃO (créditos):
processar fatura com IA    → 1
sincronizar banco          → 1
enviar para ERP            → 1
comunicar AT               → 1
abrir ticket normal        → 5
abrir ticket urgente       → 10PACKS AVULSO:
500 créditos   → 29€
1500 créditos  → 79€
5000 créditos  → 199€ALERTAS:
30% créditos restantes → email aviso
10% créditos restantes → email urgente + notificação in-app
0 créditos             → bloquear ações + email + notificação in-app

---

## 🇵🇹 Utilitários Portugal

```typescript// lib/utils/portugal.tsexport function validateNIF(nif: string): boolean {
if (!/^\d{9}$/.test(nif)) return false
const digits = nif.split('').map(Number)
let sum = 0
for (let i = 0; i < 8; i++) sum += digits[i] * (9 - i)
const remainder = sum % 11
const check = remainder < 2 ? 0 : 11 - remainder
return check === digits[8]
}export const VAT_RATES = { normal: 23, intermediate: 13, reduced: 6, exempt: 0 }export const formatCurrency = (v: number) =>
new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)export const formatDate = (d: string) =>
new Intl.DateTimeFormat('pt-PT').format(new Date(d))

---

## ⚠️ Regras Absolutas de DesenvolvimentoSEGURANÇA:

NUNCA query sem filtro tenant_id
SEMPRE usar get_user_tenant_id() para verificar tenant
SEMPRE validar assinatura de webhooks (Twilio, Stripe, Resend)
SEMPRE encriptar API keys externas antes de guardar na DB
NUNCA expor SUPABASE_SERVICE_ROLE_KEY no cliente
NUNCA logar NIF, IBAN, credenciais ou valores em logs
Rate limiting em TODOS os endpoints públicos
Validar TODOS os inputs com Zod antes de processar
CÓDIGO:
9.  TypeScript strict - ZERO any, ZERO ts-ignore
10. SEMPRE try/catch em chamadas a APIs externas
11. SEMPRE loading states durante operações async
12. SEMPRE feedback ao utilizador (toast sucesso/erro)
13. Server Components por defeito, Client só quando necessário
14. Variáveis de ambiente NUNCA hardcodedCOMPLIANCE:
15. Dados APENAS em região europeia (RGPD)
16. Audit log em TODAS as ações importantes
17. Endpoint de apagamento total de dados por tenant
18. Backups automáticos diários via SupabasePERFORMANCE:
19. Índices em tenant_id + created_at + project_id
20. Paginação obrigatória - máximo 50 registos por página
21. Ficheiros via CDN Supabase Storage
22. Nunca bloquear a UI durante uploads (background processing)

---

## 🌍 Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude AI (extração de faturas)
ANTHROPIC_API_KEY=

# Twilio WhatsApp (inbound)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# Resend (email transacional + inbound de faturas)
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=

# Stripe (subscrições + créditos)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_BUSINESS_PRICE_ID=
STRIPE_PRO_PRICE_ID=

# Tink (Open Banking - substitui Salt Edge)
# https://console.tink.com → Apps → credentials
TINK_CLIENT_ID=
TINK_CLIENT_SECRET=
TINK_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=
ADMIN_EMAIL=
# AES-256 em hex (gerar com: openssl rand -hex 32)
ENCRYPTION_KEY=
# UUID do super-admin (lookup em auth.users)
SUPER_ADMIN_USER_ID=

# Inbound de faturas + AI
# Bucket Supabase Storage onde guardamos PDFs/imagens das faturas
INVOICE_FILES_BUCKET=
# Domínio para emails inbound (ex: "isoflow.pt" → faturas+<tenant>@isoflow.pt)
INBOUND_EMAIL_DOMAIN=

# Gmail (OAuth - inbound de email alternativo a Resend)
# Cria app OAuth em https://console.cloud.google.com
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=

# n8n (ERP forwarder default - clientes podem override por tenant)
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=

# Vercel Cron Jobs
# Secret para validar pedidos cron (header Authorization: Bearer <CRON_SECRET>)
CRON_SECRET=
```

 TASKS ACTUAIS - Sprint de Testes

Implementa estas 3 funcionalidades por ordem. Não alteres nada fora do que está descrito.
Antes de qualquer alteração, lê o ficheiro completo envolvido.


⚠️ REGRAS DE SEGURANÇA PARA ESTAS TASKS
Regra 1 - Antes de alterar InvoiceStatus em types/index.ts:
Corre primeiro:
bashgrep -r "InvoiceStatus|STATUS_LABELS|STATUS_CLASSES" --include="*.ts" --include="*.tsx" -l | grep -v node_modules | grep -v .next
Actualiza TODOS os ficheiros encontrados em simultâneo. Ficheiros confirmados com Record<InvoiceStatus, ...>:

components/faturas/status-badge.tsx - STATUS_LABELS e STATUS_CLASSES
components/faturas/invoice-filters.tsx - <SelectItem> de estados

Regra 2 - Não alterar assinaturas de API routes existentes.
Só criar novas: /api/faturas/[id]/file-url e /api/faturas/sync-toconline.
Regra 3 - Não tocar em: middleware.ts, lib/supabase/, app/(auth)/.
Regra 4 - O status na tabela invoices é text com CHECK constraint (não enum PostgreSQL). Actualizar o CHECK constraint na migration e os tipos TypeScript.

TASK 1 - Gráfico Receita vs Gastos no Dashboard
1. lib/queries/dashboard.ts
Alterar ChartPoint (actualmente { month: string; count: number; value: number }):
tsexport type ChartPoint = {
  month: string
  count: number
  value: number      // manter
  revenue: number    // novo - soma de outgoing
  expenses: number   // novo - soma de incoming
}
Adicionar a DashboardKpis (sem remover campos existentes):
tsrevenue_this_month: number
expenses_this_month: number
net_this_month: number
Na query monthInvoices, adicionar type ao select:
ts.select("id, total, status, invoice_date, created_at, type")
Calcular após monthList:
tsconst revenue = monthList.filter(i => i.type === "outgoing").reduce((s, i) => s + Number(i.total ?? 0), 0)
const expenses = monthList.filter(i => i.type === "incoming").reduce((s, i) => s + Number(i.total ?? 0), 0)
// kpis: { ...existentes, revenue_this_month: revenue, expenses_this_month: expenses, net_this_month: revenue - expenses }
Na query chartRows, adicionar type:
ts.select("created_at, total, type")
Actualizar buildChart: inicializar buckets com revenue: 0, expenses: 0. No loop separar por tipo. Incluir no return.
2. components/dashboard/invoices-chart.tsx
tsconst chartConfig = {
  revenue: { label: "Receita", color: "hsl(var(--chart-1))" },
  expenses: { label: "Gastos", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig
Substituir <Bar dataKey="count"/> por duas barras: revenue e expenses.
Actualizar CardTitle para "Receita vs Gastos - 6 meses".
Manter: Card, ChartContainer, h-56 w-full, CartesianGrid, XAxis.
3. app/(dashboard)/page.tsx
Adicionar imports TrendingUp, TrendingDown de lucide-react.
Mudar grid para sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 e adicionar 2 KpiCards:
tsx<KpiCard label="Receita este mês" value={formatCurrency(data.kpis.revenue_this_month)} icon={TrendingUp} hint="Faturas emitidas" />
<KpiCard label="Gastos este mês" value={formatCurrency(data.kpis.expenses_this_month)} icon={TrendingDown} hint="Faturas recebidas" />

TASK 2 - Detalhe da Fatura com Imagem + Campos Editáveis
Criar app/api/faturas/[id]/file-url/route.ts:

GET - verificar tenant_id, gerar signed URL (TTL 3600s) do bucket invoice-files
Retornar { url: string, file_type: string }

Implementar lib/queries/invoice-detail.ts:
tsexport async function getInvoiceDetail(invoiceId: string, tenantId: string)
// Select todos os campos + project(id, name, color, type)
// Retornar null se não encontrar
Implementar app/(dashboard)/faturas/[id]/page.tsx:

Server Component, chamar getInvoiceDetail, redirect /faturas se null
Layout 2 colunas (mobile: stack vertical)
Banner âmbar se needs_review: true
Breadcrumb: Faturas → número da fatura

Implementar components/faturas/invoice-detail.tsx:
Painel esquerdo (viewer):

Buscar signed URL de GET /api/faturas/[id]/file-url
PDF → PdfViewer; imagem → <img>; sem ficheiro → placeholder com ícone FileText
Botão "Descarregar original"

Painel direito (dados + edição):

Modo visualização por defeito, botão "Editar"
Modo edição: todos os campos inline editáveis (supplier_name, supplier_nif, invoice_number, invoice_date, due_date, subtotal, vat_rate, vat_amount, total, description, category, notes)
category → Select com: transporte, alimentacao, tecnologia, servicos, material, combustivel, comunicacoes, alojamento, formacao, outro
Save → PATCH /api/faturas/{id} + toast
Usar react-hook-form + zod

Secção de estados:

<StatusBadge status={invoice.status} />
Badge ERP: erp_synced → verde "ERP Sincronizado" / cinza "ERP Pendente"
Badge AT: at_communicated → verde "Na e-Fatura" / cinza "Não comunicado AT"
Se needs_review: badge âmbar "Precisa Revisão"


TASK 3 - Integração TOCONLINE + Estados de Conciliação
Implementar lib/integrations/toconline.ts (actualmente export {}):
tsexport interface TOCOnlineDocument {
  id: number
  document_type: string
  date: string
  document_number: string
  total: number
  subtotal: number
  vat_total: number
  communication_status?: string  // "sent"|"pending"|"error"
  supplier_tax_registration_number?: string
  supplier_business_name?: string
  client_tax_registration_number?: string
  client_business_name?: string
}

export async function fetchPurchaseDocuments(accessToken: string, baseUrl: string, filters?: { dateFrom?: string; dateTo?: string }): Promise<TOCOnlineDocument[]>
// GET /api/v1/commercial_purchases_documents com filtros de data

export async function fetchSalesDocuments(accessToken: string, baseUrl: string, filters?: { dateFrom?: string; dateTo?: string }): Promise<TOCOnlineDocument[]>
// GET /api/v1/commercial_sales_documents com filtros de data

export function mapTOCDocumentToInvoice(doc: TOCOnlineDocument, tenantId: string, invoiceType: "incoming" | "outgoing"): Partial<Invoice>
// erp_document_id = doc.id.toString()
// at_communicated = doc.communication_status === "sent"
// erp_synced = true, source = "erp"
Criar app/api/faturas/sync-toconline/route.ts:

POST { month: number, year: number, type: "purchases"|"sales"|"both" }
Buscar integração em tenant_integrations (type="erp", provider="toconline")
Para cada documento: procurar por erp_document_id primeiro, depois por supplier_nif + invoice_number
Se encontrar → UPDATE com erp_synced=true, erp_document_id, at_communicated, erp_synced_at=now()
Se não encontrar → INSERT com mapTOCDocumentToInvoice
Retornar { created: n, updated: n, errors: string[] }

Implementar app/api/integracoes/toconline/route.ts:

GET - testar ligação ao TOCONLINE
POST { action: "sync", month?, year? } - trigger sync manual

Actualizar em SIMULTÂNEO (compilação TypeScript):
types/index.ts - adicionar | "reconciled" a InvoiceStatus
components/faturas/status-badge.tsx:
ts// STATUS_LABELS: reconciled: "Conciliada AT"
// STATUS_CLASSES: reconciled: "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-900/20 dark:text-violet-200 dark:border-violet-900/40"
components/faturas/invoice-filters.tsx:
tsx<SelectItem value="reconciled">Conciliada AT</SelectItem>
// Adicionar após <SelectItem value="duplicate">
components/configuracoes/erp-integration-card.tsx:

Botão "Sincronizar TOCONLINE" → POST /api/faturas/sync-toconline
Loading state + toast com resultado

Criar supabase/migrations/014_toconline_indexes.sql:
sql-- Actualizar CHECK constraint (status é text, não enum)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('pending','processing','matched','paid','rejected','duplicate','reconciled'));

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_invoices_erp_document_id
  ON invoices(tenant_id, erp_document_id) WHERE erp_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_type_date
  ON invoices(tenant_id, type, invoice_date) WHERE status != 'rejected';

Ordem de implementação

supabase/migrations/014_toconline_indexes.sql - correr no Supabase primeiro
types/index.ts + status-badge.tsx + invoice-filters.tsx - em simultâneo
TASK 2 completa
TASK 1
TASK 3