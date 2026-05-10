# TASKS.md — ISOFlow Development Tasks

## Regras para o Claude Code
- Fazer UMA tarefa de cada vez
- Confirmar conclusão antes de avançar
- Ler CLAUDE.md + PRD.md + TECH.md antes de começar
- Cada tarefa deve resultar em código que compila sem erros
- Fazer commit descritivo após cada tarefa

---

## FASE 1 — BASE E AUTENTICAÇÃO

### TASK 1.1 — Setup inicial do projeto
- Criar projeto Next.js 14 com TypeScript + Tailwind + App Router
- Instalar todas as dependências de TECH.md
- Configurar shadcn/ui com tema neutro
- Configurar tsconfig.json com strict mode
- Criar ficheiro .env.local com todas as variáveis de CLAUDE.md
- Criar ficheiro .env.example (sem valores reais)
- Configurar .gitignore

### TASK 1.2 — Supabase setup e migrations
- Inicializar Supabase CLI
- Criar todas as migrations em ordem (001 a 013) de CLAUDE.md
- Aplicar migrations com `supabase db push`
- Gerar tipos TypeScript com Supabase CLI
- Criar lib/supabase/client.ts e lib/supabase/server.ts de TECH.md
- Criar middleware.ts com proteção de rotas

### TASK 1.3 — Tipos TypeScript globais
- Criar types/index.ts com todos os tipos principais:
  Tenant, User, Project, Invoice, BankTransaction,
  Reconciliation, SupportTicket, CreditTransaction
- Garantir que os tipos espelham exatamente o schema da DB

### TASK 1.4 — Layout de autenticação
- Criar app/(auth)/layout.tsx com design centrado
- Logo ISOFlow centrado no topo
- Card branco com sombra suave
- Design limpo e profissional

### TASK 1.5 — Página de login
- Criar app/(auth)/login/page.tsx
- Campos: email + password
- Validação com Zod + React Hook Form
- Integração com Supabase Auth
- Link para /register
- Link "Esqueci a password"
- Toast de erro em caso de falha
- Redirect para /dashboard após login

### TASK 1.6 — Página de registo
- Criar app/(auth)/register/page.tsx
- Campos: nome completo, email, password, confirmar password, nome da empresa
- Validação completa com Zod
- Criar: auth.user → tenant → user (role: owner)
- Redirect para /onboarding após registo

### TASK 1.7 — Página de recuperação de password
- Criar app/(auth)/forgot-password/page.tsx
- Campo email + botão enviar
- Integração com Supabase Auth resetPasswordForEmail
- Criar app/(auth)/reset-password/page.tsx
- Novo password + confirmar + atualizar

### TASK 1.8 — Onboarding wizard
- Criar app/onboarding/page.tsx
- 3 passos com indicador de progresso
- Passo 1: dados da empresa (nome, NIF, telefone, morada)
- Passo 2: seleção de ERP (Toconline | Primavera | Atura | Saltar)
- Passo 3: ligar banco (botão Salt Edge | Saltar)
- Ao completar: marcar onboarding_completed = true → redirect /dashboard

---

## FASE 2 — LAYOUT E DASHBOARD

### TASK 2.1 — Layout principal do dashboard
- Criar app/(dashboard)/layout.tsx
- Sidebar com logo (dinâmico por tenant)
- Navegação: Dashboard, Faturas, Projetos, Conciliação, Banco, Suporte, Configurações
- Header com: nome do utilizador, avatar, créditos disponíveis, dropdown logout
- Mobile: menu hamburger com drawer
- Aplicar cor primária do tenant via CSS variable

### TASK 2.2 — Sidebar component
- Criar components/layout/sidebar.tsx
- Logo do tenant (se definido) ou logo ISOFlow
- Links de navegação com ícones Lucide
- Link ativo destacado
- Role-based: Member vê sidebar simplificada
- Créditos no rodapé da sidebar

### TASK 2.3 — Hook useTenant
- Criar hooks/use-tenant.ts
- Buscar dados do tenant do utilizador autenticado
- Cache com React cache ou SWR
- Expor: tenant, user, role, loading

### TASK 2.4 — Hook usePermissions
- Criar hooks/use-permissions.ts
- Baseado em lib/utils/permissions.ts de TECH.md
- Expor: hasPermission(resource, action)
- Usado para mostrar/esconder elementos na UI

### TASK 2.5 — Dashboard KPIs
- Criar app/(dashboard)/page.tsx
- 4 KPI cards: faturas este mês, valor total, % conciliadas, créditos
- Componente components/dashboard/kpi-card.tsx
- Dados reais do Supabase (Server Component)

### TASK 2.6 — Dashboard gráfico e atividade
- Gráfico de barras: faturas por mês (últimos 6 meses)
- Usar Recharts (já incluído no shadcn)
- Lista de 10 faturas mais recentes
- Painel de alertas: faturas vencidas, créditos baixos

---

## FASE 3 — PROJETOS

### TASK 3.1 — Lista de projetos
- Criar app/(dashboard)/projetos/page.tsx
- Grid de cards com: nome, tipo, estado, barra orçamento, total gasto, nº faturas
- Criar components/projetos/project-card.tsx
- Criar components/projetos/budget-progress.tsx
- Filtros: estado, tipo
- Botão "Novo projeto"
- Server Component com dados reais

### TASK 3.2 — Formulário criar/editar projeto
- Criar app/(dashboard)/projetos/novo/page.tsx
- Criar components/projetos/project-form.tsx
- Todos os campos de PRD.md secção 4.2
- Color picker para cor do projeto
- Campo aliases (tags input para matching automático)
- Se Admin/Owner: seletor de membros
- API route: POST /api/projetos

### TASK 3.3 — Detalhe do projeto
- Criar app/(dashboard)/projetos/[id]/page.tsx
- KPIs: total gasto, orçamento restante, nº faturas, % orçamento
- Alerta visual vermelho/amarelo se > threshold
- Gráfico gastos por mês (Recharts)
- Gráfico distribuição por categoria (pie chart)
- Lista de faturas do projeto (componente reutilizável)
- Botão exportar relatório PDF

### TASK 3.4 — API routes de projetos
- Criar app/api/projetos/route.ts (GET lista, POST criar)
- Criar app/api/projetos/[id]/route.ts (GET, PATCH, DELETE)
- Validação Zod em todos os endpoints
- Verificar permissões por role
- Registar em audit_logs

### TASK 3.5 — Matching automático de projetos
- Criar lib/utils/projects.ts com matchProjectFromText()
- Normalizar texto: lowercase, trim, remover acentos
- Match por name e name_aliases
- Testes de matching com casos edge

---

## FASE 4 — FATURAS

### TASK 4.1 — Lista de faturas
- Criar app/(dashboard)/faturas/page.tsx
- TanStack Table com colunas de PRD.md secção 3.1
- Filtros: período, estado, projeto, origem, categoria
- Paginação 50 por página
- Ordenação por colunas
- Server Component com dados reais
- Member vê apenas as suas faturas

### TASK 4.2 — Status badge component
- Criar components/faturas/status-badge.tsx
- Cores: pending=amarelo, processing=azul, matched=verde,
         paid=verde escuro, rejected=vermelho, duplicate=cinza

### TASK 4.3 — Upload manual de faturas
- Criar app/(dashboard)/faturas/nova/page.tsx
- Criar components/faturas/upload-zone.tsx
- Drag & drop + click to upload
- Preview do ficheiro após seleção
- Seletor de projeto (dropdown)
- Botão processar com loading state
- Chamar /api/faturas/process
- Mostrar dados extraídos em formulário editável
- Confirmar e guardar

### TASK 4.4 — API de processamento com Claude
- Criar app/api/faturas/process/route.ts
- Receber ficheiro em multipart/form-data
- Upload para Supabase Storage
- Chamar lib/claude/extract-invoice.ts
- Criar invoice na DB com dados extraídos
- Debitar 1 crédito
- Retornar invoice criada

### TASK 4.5 — Detalhe da fatura
- Criar app/(dashboard)/faturas/[id]/page.tsx
- PDF viewer (lado esquerdo) ou preview de imagem
- Formulário editável (lado direito) com todos os campos
- Seletor de projeto inline
- Botões: Marcar como paga, Enviar para ERP, Comunicar AT
- Linha temporal de eventos da fatura

### TASK 4.6 — API CRUD de faturas
- Criar app/api/faturas/route.ts (GET com filtros, POST)
- Criar app/api/faturas/[id]/route.ts (GET, PATCH, DELETE)
- Validação Zod completa
- Verificar permissões
- Audit logging

### TASK 4.7 — PDF Viewer component
- Criar components/faturas/pdf-viewer.tsx
- Usar react-pdf ou iframe para PDFs
- Fallback para imagem se não for PDF
- Signed URL do Supabase Storage (válido 1 hora)

---

## FASE 5 — WEBHOOKS WHATSAPP E EMAIL

### TASK 5.1 — Webhook WhatsApp (Twilio)
- Criar app/api/webhooks/whatsapp/route.ts
- Validar assinatura Twilio (OBRIGATÓRIO)
- Identificar tenant pelo número de destino
- Verificar créditos disponíveis
- Extrair ficheiro do MediaUrl
- Match automático de projeto pelo texto
- Processar fatura com Claude API
- Responder via Twilio com confirmação (texto de PRD.md)

### TASK 5.2 — Criar lib/twilio/whatsapp.ts
- Função downloadMedia(mediaUrl): baixar ficheiro da Twilio
- Função sendMessage(to, body): enviar mensagem WhatsApp
- Função validateSignature(token, signature, url, params)

### TASK 5.3 — Webhook Email (Resend)
- Criar app/api/webhooks/email/route.ts
- Validar webhook secret Resend
- Identificar tenant pelo endereço de destino
- Extrair anexos do payload
- Para cada anexo: processar como fatura
- Match de projeto pelo assunto

### TASK 5.4 — Notificações por email
- Criar lib/resend/notifications.ts
- Templates de email com branding ISOFlow
- Funções: sendInvoiceReceived, sendBudgetAlert,
           sendLowCredits, sendTicketReply

---

## FASE 6 — BANCO E CONCILIAÇÃO

### TASK 6.1 — Integração Salt Edge
- Criar lib/banking/salt-edge.ts
- Função createCustomer(tenantId): criar customer Salt Edge
- Função getConnectUrl(customerId): URL de autenticação bancária
- Função getTransactions(connectionId, from, to): buscar movimentos
- Webhook handler: app/api/webhooks/banking/route.ts

### TASK 6.2 — Lista de movimentos bancários
- Criar app/(dashboard)/banco/page.tsx
- TanStack Table com movimentos
- Colunas: data, descrição, banco, valor (colorido: verde entrada, vermelho saída), estado match
- Filtros: conta, período, tipo, matched/unmatched
- Botão sincronizar (debita 1 crédito)
- Botão ligar novo banco

### TASK 6.3 — Engine de conciliação automática
- Criar lib/banking/reconciliation.ts
- Função calculateMatchScore(invoice, transaction): ver CLAUDE.md
- Função runAutoReconciliation(tenantId): correr para todos os não matched
- Confirmar automaticamente se score >= 0.95
- Sugerir se score >= 0.80

### TASK 6.4 — Vista de conciliação (Split View)
- Criar app/(dashboard)/conciliacao/page.tsx
- Criar components/conciliacao/split-view.tsx
- Layout 50/50: banco | faturas
- Seleção interativa com highlight
- Cards de sugestão automática com badge score
- Botão confirmar/rejeitar match
- Resumo no topo com totais não conciliados
- Filtros sincronizados entre os dois painéis

### TASK 6.5 — API routes conciliação
- Criar app/api/conciliacao/auto/route.ts (POST: correr auto-match)
- Criar app/api/conciliacao/manual/route.ts (POST: confirmar match manual)
- Atualizar invoice.bank_transaction_id e bank_transaction.invoice_id
- Criar registo em reconciliations
- Audit log

---

## FASE 7 — SISTEMA DE CRÉDITOS E STRIPE

### TASK 7.1 — Sistema de créditos
- Criar lib/utils/credits.ts com debitCredits() de TECH.md
- Criar função RPC no Supabase: debit_credits (atómica)
- Função checkCreditAlerts(): verificar e enviar emails de alerta
- Hook use-credits.ts: saldo atual em tempo real

### TASK 7.2 — Stripe setup
- Criar lib/stripe/subscriptions.ts
- Criar 4 produtos/preços no Stripe (starter, business, pro, enterprise)
- Função createCheckoutSession(tenantId, priceId)
- Função createBillingPortalSession(tenantId)
- Função createCustomer(tenant)

### TASK 7.3 — Webhook Stripe
- Criar app/api/webhooks/stripe/route.ts
- Validar assinatura Stripe
- Handlers:
  - checkout.session.completed → ativar subscrição + adicionar créditos mensais
  - invoice.payment_succeeded → renovar créditos mensais
  - invoice.payment_failed → email aviso + status past_due
  - customer.subscription.deleted → suspender tenant

### TASK 7.4 — Página de plano
- Criar app/(dashboard)/configuracoes/plano/page.tsx
- Plano atual com features comparativas
- Barra de progresso de créditos
- Histórico de consumo de créditos (tabela)
- Botão upgrade → Stripe Checkout
- Botão gerir faturação → Stripe Portal
- Comprar créditos avulso (3 opções de pack)

---

## FASE 8 — CONFIGURAÇÕES

### TASK 8.1 — Configurações da empresa e branding
- Criar app/(dashboard)/configuracoes/page.tsx
- Formulário: nome, NIF, email, telefone, morada
- Upload de logo com preview em tempo real
  - Guardar em Supabase Storage: tenant-assets/{tenant_id}/logo.{ext}
  - Atualizar tenants.logo_url
- Color picker para cor primária
  - Preview imediato da cor na sidebar
- Campo nome da aplicação
- Favicon upload (opcional)

### TASK 8.2 — Configurações de integrações
- Criar app/(dashboard)/configuracoes/integracoes/page.tsx
- Cards para cada tipo: ERP, Banco, WhatsApp, Email
- Criar components/configuracoes/integration-card.tsx
- Estado visual: ligado (verde) / desligado (cinza) / erro (vermelho)
- Formulário por integração (campos específicos)
- Botão testar ligação + feedback
- Botão desligar com confirmação

### TASK 8.3 — Gestão de utilizadores
- Criar app/(dashboard)/configuracoes/utilizadores/page.tsx
- Tabela: nome, email, role badge, projetos, último acesso, estado
- Criar components/configuracoes/user-invite-form.tsx
- Convidar: email + role + projetos (se member)
- Editar: alterar role, projetos
- Desativar: confirmar + bloquear acesso
- Só Owner e Admin podem aceder

---

## FASE 9 — SUPORTE E TICKETS

### TASK 9.1 — Lista de tickets
- Criar app/(dashboard)/suporte/page.tsx
- Tabela com: título, categoria, prioridade badge, estado badge, data, créditos usados
- Filtros: estado, prioridade, categoria
- Botão criar ticket

### TASK 9.2 — Criar ticket
- Modal ou página /suporte/novo
- Campos: título, descrição, categoria, prioridade
- Mostrar custo em créditos antes de confirmar
- Verificar créditos suficientes
- Debitar ao criar
- Audit log

### TASK 9.3 — Chat do ticket
- Criar app/(dashboard)/suporte/[id]/page.tsx
- Criar components/suporte/ticket-chat.tsx
- Mensagens em tempo real com Supabase Realtime
- Bolhas de chat: cliente (direita, azul) | suporte (esquerda, cinza)
- Upload de ficheiros (screenshots)
- Estado do ticket visível e editável pelo support

---

## FASE 10 — PAINEL ADMIN

### TASK 10.1 — Layout e proteção admin
- Criar app/(admin)/layout.tsx
- Verificar SUPER_ADMIN_USER_ID no middleware
- Redirect 404 se não for super admin
- Sidebar admin separada

### TASK 10.2 — Dashboard admin
- Criar app/(admin)/page.tsx
- MRR total, novos clientes, tickets abertos
- Alertas: clientes sem créditos, pagamentos falhados

### TASK 10.3 — Gestão de clientes
- Criar app/(admin)/clientes/page.tsx
- Tabela com todos os tenants
- Filtros: plano, estado
- Criar app/(admin)/clientes/[id]/page.tsx
- Editar plano, adicionar créditos bonus, suspender/reativar

### TASK 10.4 — Gestão de tickets admin
- Criar app/(admin)/tickets/page.tsx
- Todos os tickets de todos os clientes
- Responder diretamente
- Marcar como resolvido

---

## FASE 11 — PWA E POLISH

### TASK 11.1 — PWA configuration
- Criar public/manifest.json
- Ícones em vários tamanhos
- Configurar next.config.ts para PWA
- Service Worker básico para cache offline do dashboard

### TASK 11.2 — Mobile responsiveness
- Verificar e corrigir todos os layouts em mobile
- Sidebar em drawer no mobile
- Tabelas com scroll horizontal no mobile
- Split view conciliação em stacked no mobile

### TASK 11.3 — Loading states e error boundaries
- Adicionar Suspense + loading.tsx em todas as páginas
- Error boundaries em todas as páginas
- Skeleton loaders nos componentes principais

### TASK 11.4 — Empty states
- Empty states em todas as listagens
- Mensagens claras e botões de ação
- Ex: "Ainda não tens faturas. Envia a primeira via WhatsApp ou faz upload aqui."

---

## FASE 12 — INTEGRAÇÕES ERP (PÓS-MVP)

### TASK 12.1 — Toconline API
- Criar lib/integrations/toconline.ts
- Autenticação com API Key
- Função syncInvoice(invoice): criar documento no Toconline
- Função getInvoices(): listar faturas do Toconline

### TASK 12.2 — Atura SDK
- Criar lib/integrations/atura.ts
- npm install @atura/node
- Função createInvoice(invoice): criar fatura certificada AT
- Integração na UI: botão "Comunicar à AT" no detalhe da fatura

### TASK 12.3 — Primavera API
- Criar lib/integrations/primavera.ts
- Autenticação OAuth
- Função syncInvoice(invoice)

---

## ORDEM RECOMENDADA PARA COMEÇAR

```
Sessão 1: TASK 1.1 + 1.2 + 1.3 (setup base)
Sessão 2: TASK 1.4 + 1.5 + 1.6 (auth)
Sessão 3: TASK 1.7 + 1.8 (forgot password + onboarding)
Sessão 4: TASK 2.1 + 2.2 + 2.3 + 2.4 (layout + hooks)
Sessão 5: TASK 2.5 + 2.6 (dashboard)
Sessão 6: TASK 3.1 + 3.2 (projetos lista + form)
Sessão 7: TASK 3.3 + 3.4 + 3.5 (projeto detalhe + API + matching)
Sessão 8: TASK 4.1 + 4.2 (faturas lista)
Sessão 9: TASK 4.3 + 4.4 (upload + Claude API)
Sessão 10: TASK 4.5 + 4.6 + 4.7 (detalhe + API + PDF)
...continuar por fases
```