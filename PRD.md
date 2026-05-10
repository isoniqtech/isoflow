# PRD.md — ISOFlow Product Requirements Document

## Versão: 1.0 | Produto: ISOFlow | Empresa: ISONIQ TECH

---

## 1. FLUXOS DE AUTENTICAÇÃO

### 1.1 Registo
1. Utilizador acede a /register
2. Preenche: nome, email, password, nome da empresa, NIF (opcional)
3. Sistema cria: auth.user → tenant → user (role: owner)
4. Redireciona para /onboarding

### 1.2 Onboarding (3 passos)
**Passo 1 — Empresa**
- Nome da empresa (pré-preenchido)
- NIF
- Telefone
- Morada
- Upload de logo (opcional)
- Cor primária (color picker, opcional)

**Passo 2 — Integração ERP**
- Opções: Toconline | Primavera | Atura | Nenhum por agora
- Se escolher: campos de API Key / credenciais
- Pode saltar

**Passo 3 — Banco**
- Botão "Ligar banco" → abre Salt Edge OAuth
- Pode saltar
- Após completar → redireciona para dashboard

### 1.3 Login
- Email + password
- Redireciona para /dashboard
- Se onboarding_completed = false → redireciona para /onboarding

### 1.4 Convite de utilizador
- Owner/Admin convida por email em /configuracoes/utilizadores
- Define role e projetos atribuídos (para role member)
- Sistema envia email com link de convite (Supabase invite)
- Utilizador define password e acede diretamente ao dashboard

---

## 2. DASHBOARD

### KPIs principais (este mês)
- Total de faturas recebidas
- Valor total em faturas
- Faturas conciliadas com banco (% e número)
- Créditos disponíveis (com barra de progresso)

### Alertas (painel lateral ou topo)
- Faturas com due_date ultrapassada
- Faturas sem projeto atribuído (se > 0)
- Projetos acima do threshold de orçamento
- Créditos abaixo de 30%
- Banco não sincronizado há mais de 7 dias

### Gráfico
- Barras: total de faturas por mês (últimos 6 meses)
- Linha: valor total por mês

### Atividade recente
- Últimas 10 faturas recebidas com: fonte, fornecedor, valor, estado

### Projetos ativos
- Cards dos 3-4 projetos mais recentes com barra de orçamento

---

## 3. FATURAS

### 3.1 Lista de Faturas (/faturas)

**Colunas da tabela:**
- Fornecedor
- Número da fatura
- Data
- Projeto (badge colorido ou "—")
- Valor total
- Estado (badge)
- Origem (ícone: WhatsApp / Email / Manual)
- Ações (ver, editar projeto, apagar)

**Filtros disponíveis:**
- Período (date range picker)
- Estado: todos | pendente | conciliado | pago | rejeitado
- Projeto: dropdown com todos os projetos
- Origem: todos | WhatsApp | Email | Manual
- Categoria: dropdown
- Necessita revisão: toggle

**Ordenação:** por data (desc por defeito), valor, fornecedor

**Paginação:** 50 por página

**Ações em massa:**
- Exportar CSV/Excel selecionadas
- Mover para projeto
- Marcar como pagas

### 3.2 Upload Manual (/faturas/nova)
1. Drag & drop ou clique para selecionar ficheiro
2. Tipos aceites: PDF, JPG, JPEG, PNG — máx 10MB
3. Seletor de projeto (opcional)
4. Botão "Processar fatura"
5. Loading: "A extrair dados com IA..."
6. Resultado: formulário pré-preenchido com dados extraídos
7. Utilizador revê e confirma (ou edita campos incorretos)
8. Fatura guardada + 1 crédito debitado

**Se ai_confidence < 0.7:**
- Banner amarelo: "Dados extraídos com baixa confiança. Por favor revê."
- Campos com menor confiança destacados a amarelo

### 3.3 Detalhe da Fatura (/faturas/[id])
- Lado esquerdo: PDF viewer / pré-visualização da imagem
- Lado direito: formulário com todos os campos editáveis
- Histórico: linha temporal (recebida, processada, conciliada, etc.)
- Botão: Associar a projeto
- Botão: Marcar como paga
- Botão: Enviar para ERP (se integração ativa)
- Botão: Comunicar à AT (se integração ativa)

---

## 4. PROJETOS / OBRAS

### 4.1 Lista de Projetos (/projetos)

**Vista em cards com:**
- Nome + código
- Tipo (badge: Obra / Projeto / Departamento)
- Estado (badge colorido)
- Barra de progresso do orçamento (se budget definido)
- Total gasto / orçamento total
- Número de faturas
- Data de início / fim

**Filtros:** estado, tipo

**Ordenação:** mais recente, valor gasto, % orçamento

### 4.2 Criar/Editar Projeto (/projetos/novo)

**Campos:**
- Nome* (obrigatório)
- Código (ex: OB-2025-001, gerado automaticamente se vazio)
- Tipo: Obra | Projeto | Departamento | Cliente | Outro
- Descrição
- Estado: Ativo | Pausado | Concluído | Cancelado
- Orçamento (€)
- Alerta de orçamento (% — default 80%)
- Data início / Data fim
- Cor (color picker — para identificação visual)
- Cliente/dono da obra
- Localização
- Notas
- Aliases (tags de texto para matching automático)
  - Ex: "obra1", "ob1", "moradia setúbal"
  - Utilizados para match automático via WhatsApp/email
- Membros com acesso (para role member)

### 4.3 Detalhe do Projeto (/projetos/[id])

**KPIs:**
- Total gasto (soma faturas não rejeitadas)
- Orçamento restante
- Número de faturas
- % do orçamento usado (com alerta visual se > threshold)

**Gráfico:** gastos por mês no projeto

**Gráfico:** distribuição por categoria (pie chart)

**Lista de faturas do projeto:**
- Mesma tabela de /faturas filtrada por projeto
- Filtros: estado, data, categoria

**Botão:** Exportar relatório PDF

### 4.4 Relatório PDF do Projeto (/projetos/[id]/relatorio)
- Logo da empresa
- Nome e detalhes do projeto
- KPIs: total gasto, orçamento, % usado
- Tabela de todas as faturas
- Total por categoria
- Gráfico de gastos por mês
- Gerado server-side, download automático

---

## 5. CONCILIAÇÃO BANCÁRIA

### 5.1 Vista Split (/conciliacao)

**Layout:**
- Esquerda (50%): movimentos bancários sem match
- Direita (50%): faturas sem match
- Ordenados por data (mais recentes primeiro)

**Comportamento:**
- Clicar num movimento → fica selecionado (highlight azul)
- Clicar numa fatura com movimento selecionado → cria match
- Sistema mostra score de confiança do match
- Botão confirmar / cancelar

**Sugestões automáticas:**
- Movimentos com match automático sugerido (score > 0.8) aparecem destacados
- Badge "Sugestão IA" com o score
- Um clique para confirmar

**Resumo no topo:**
- X movimentos sem match | Y faturas sem match
- Valor total não conciliado

**Filtros:**
- Período (ambos os lados sincronizados)
- Valor mínimo / máximo
- Projeto (filtra faturas por projeto)

### 5.2 Lógica de Match Automático
Score calculado por:

Valor igual:              +50 pontos
Valor próximo (±2%):      +30 pontos
Data próxima (±5 dias):   +30 pontos
Descrição contém NIF:     +20 pontos
Mesmo fornecedor:         +20 pontos
Total possível: 150 pontos → normalizar para 0-1

Se score >= 0.8 → sugerir match automático
Se score >= 0.95 → confirmar match automático (sem intervenção)

---

## 6. BANCO

### 6.1 Lista de Movimentos (/banco)

**Colunas:** data, descrição, banco/conta, valor, tipo, estado match

**Filtros:** conta bancária, período, tipo (entrada/saída), matched/unmatched

**Botão:** Sincronizar agora (debita 1 crédito)

**Botão:** Ligar novo banco (abre Salt Edge OAuth)

### 6.2 Ligar Banco
1. Utilizador clica "Ligar banco"
2. Sistema cria customer no Salt Edge
3. Abre iframe/popup Salt Edge
4. Utilizador escolhe banco e autentica
5. Salt Edge envia webhook com connection_id
6. Sistema guarda em tenant_integrations
7. Sincronização inicial automática (últimos 90 dias)

---

## 7. RECEPÇÃO AUTOMÁTICA DE FATURAS

### 7.1 Via WhatsApp

**Configuração:**
- Número Twilio configurado em /configuracoes/integracoes
- Utilizadores da empresa enviam para esse número

**Fluxo:**
1. Utilizador envia foto/PDF para o número WhatsApp
2. Pode incluir texto: "obra 1" ou "projeto alpha"
3. Sistema recebe webhook Twilio
4. Identifica tenant pelo número de destino
5. Verifica créditos disponíveis
6. Faz match de projeto pelo texto (name_aliases)
7. Download do ficheiro → Supabase Storage
8. Cria invoice: status=processing, source=whatsapp
9. Chama Claude API para extração
10. Atualiza invoice com dados extraídos
11. Debita 1 crédito
12. Responde via WhatsApp:
    - ✅ Com projeto: "Fatura recebida! Associada a: Obra 1 | Valor: 1.250€ | Fornecedor: ABC Lda"
    - ❓ Sem projeto: "Fatura recebida! A que projeto pertence? Responde com o nome."
    - ❌ Sem créditos: "Sem créditos disponíveis. Acede ao ISOFlow para recarregar."

**Se resposta ao ❓:**
- Sistema aguarda resposta do mesmo número (30 minutos)
- Faz match pelo texto da resposta
- Atualiza project_id da fatura

### 7.2 Via Email

**Configuração:**
- Endereço de entrada configurado em /configuracoes/integracoes
- Ex: faturas@[empresa].isoflow.pt ou endereço próprio

**Fluxo:**
1. Email chega com anexo PDF/imagem
2. Resend webhook recebe
3. Identifica tenant pelo endereço de destino
4. Tenta match de projeto pelo assunto do email
5. Para cada anexo relevante: mesmo fluxo do WhatsApp
6. Sem resposta automática (apenas notificação in-app)

---

## 8. CONFIGURAÇÕES

### 8.1 Empresa (/configuracoes)
- Nome, NIF, email, telefone, morada
- **Upload de logo** (JPG/PNG/SVG — máx 2MB)
  - Preview em tempo real na sidebar
  - Guardado em: tenant-assets/{tenant_id}/logo.{ext}
- **Favicon** (ICO/PNG 32x32 — opcional)
- **Cor primária** (color picker)
  - Aplicada como CSS variable em toda a app
- **Nome da aplicação** (ex: "GestãoObras da XYZ" em vez de "ISOFlow")

### 8.2 Integrações (/configuracoes/integracoes)

**Cards por tipo:**
- ERP: Toconline | Primavera | Atura | Nenhum
- Banco: bancos ligados + botão ligar novo
- WhatsApp: número configurado + status
- Email: endereço de entrada + status

**Cada card mostra:**
- Estado (ligado/desligado)
- Última sincronização
- Erro (se houver)
- Botão testar ligação
- Botão desligar

### 8.3 Utilizadores (/configuracoes/utilizadores)

**Tabela:** nome, email, role, projetos, último acesso, estado

**Convidar:**
- Email
- Role: Owner | Admin | Accountant | Member
- Se Member: seletor de projetos a que tem acesso

**Editar:** alterar role, adicionar/remover projetos

**Desativar:** bloqueia acesso sem apagar dados

### 8.4 Plano (/configuracoes/plano)
- Plano atual com features
- Uso de créditos este mês (barra progresso)
- Histórico de consumo de créditos
- Botão upgrade de plano (Stripe portal)
- Botão comprar créditos avulso
- Histórico de faturas Stripe

---

## 9. SUPORTE

### 9.1 Lista de Tickets (/suporte)

**Tabela:** título, categoria, prioridade, estado, data, créditos usados

**Criar ticket:**
- Título, descrição, categoria, prioridade
- Confirmação do custo em créditos
- Debita créditos ao criar

### 9.2 Detalhe Ticket (/suporte/[id])
- Informação do ticket
- Chat em tempo real (Supabase Realtime)
- Upload de ficheiros (screenshots, PDFs)
- Estado visível e editável pelo support

---

## 10. ADMIN (ISONIQ TECH)

Acesso APENAS ao utilizador com id = SUPER_ADMIN_USER_ID

### /admin — Overview
- MRR total
- Novos clientes este mês
- Tickets abertos
- Alertas: clientes sem créditos, subscrições expiradas

### /admin/clientes
- Lista todos os tenants
- Filtros: plano, estado, com/sem créditos
- Cada cliente: nome, plano, MRR, créditos, tickets abertos, último login

### /admin/clientes/[id]
- Detalhe completo do cliente
- Editar plano manualmente
- Adicionar créditos bonus
- Suspender / reativar conta
- Ver todos os tickets do cliente

### /admin/tickets
- Todos os tickets de todos os clientes
- Filtros: prioridade, estado, cliente
- Responder diretamente

### /admin/receita
- MRR por mês (gráfico)
- Churn por mês
- Novos clientes por mês
- Receita por plano (breakdown)

---

## 11. NOTIFICAÇÕES POR EMAIL

Todos os emails enviados via Resend com branding ISOFlow.

| Evento | Destinatário |
|---|---|
| Fatura recebida (WhatsApp/email) | Owner + Admin |
| Fatura necessita revisão (IA < 0.7) | Owner + Admin |
| Projeto atingiu threshold orçamento | Owner + Admin |
| Créditos abaixo de 30% | Owner |
| Créditos esgotados | Owner |
| Novo utilizador convidado | Convidado |
| Ticket respondido | Criador do ticket |
| Subscrição renovada | Owner |
| Pagamento falhou | Owner |

---

## 12. PWA

- manifest.json com nome, ícones, cores
- Service Worker para cache offline do dashboard
- Utilizador pode instalar no telemóvel (Add to Home Screen)
- Acesso à câmara para fotografar faturas diretamente
- Ícone na homescreen com logo da empresa (se definido)