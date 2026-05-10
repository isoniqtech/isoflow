# TECH.md — ISOFlow Technical Decisions

---

## Versões de Packages

```json
{
  "next": "14.x",
  "react": "18.x",
  "typescript": "5.x",
  "@supabase/supabase-js": "2.x",
  "@supabase/ssr": "latest",
  "@anthropic-ai/sdk": "latest",
  "twilio": "5.x",
  "resend": "3.x",
  "stripe": "14.x",
  "zod": "3.x",
  "react-hook-form": "7.x",
  "@hookform/resolvers": "3.x",
  "date-fns": "3.x",
  "@tanstack/react-table": "8.x",
  "sonner": "1.x",
  "lucide-react": "latest",
  "tailwindcss": "3.x",
  "class-variance-authority": "latest",
  "clsx": "latest",
  "tailwind-merge": "latest"
}
```

---

## Convenções de Código

### Ficheiros e pastas
components/faturas/invoice-table.tsx    → kebab-case
lib/utils/portugal.ts                   → kebab-case
types/index.ts                          → kebab-case
hooks/use-invoices.ts                   → kebab-case com prefixo use-

### Componentes
```typescript
// Server Component (por defeito — sem 'use client')
export default async function InvoicesPage() { }

// Client Component (só quando necessário)
'use client'
export function InvoiceTable() { }

// Naming: PascalCase
// Props: interface NomeComponenteProps
// Export: default para páginas, named para componentes
```

### API Routes
```typescript
// app/api/faturas/route.ts
export async function GET(req: Request) { }
export async function POST(req: Request) { }

// app/api/faturas/[id]/route.ts
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) { }
```

### Validação com Zod
```typescript
// SEMPRE validar input nas API routes
const schema = z.object({
  name: z.string().min(1).max(255),
  total: z.number().positive(),
})

const body = schema.parse(await req.json())
// Se inválido → lança ZodError → responder com 400
```

### Respostas de API
```typescript
// Sucesso
return Response.json({ data: result }, { status: 200 })

// Criado
return Response.json({ data: result }, { status: 201 })

// Erro de validação
return Response.json({ error: 'Invalid input', details: err.errors }, { status: 400 })

// Não autorizado
return Response.json({ error: 'Unauthorized' }, { status: 401 })

// Não encontrado
return Response.json({ error: 'Not found' }, { status: 404 })

// Erro interno
return Response.json({ error: 'Internal server error' }, { status: 500 })
```

---

## Supabase — Padrões

### Cliente no servidor (App Router)
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value },
        set(name, value, options) { cookieStore.set(name, value, options) },
        remove(name, options) { cookieStore.set(name, '', options) },
      },
    }
  )
}
```

### Cliente no browser
```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Middleware de Auth
```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Refresh session + proteger rotas privadas
  // Redirecionar para /login se não autenticado
  // Redirecionar para /onboarding se onboarding_completed = false
  // Proteger /admin — só SUPER_ADMIN_USER_ID
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Padrão de query com tenant
```typescript
// SEMPRE incluir tenant_id — nunca omitir
const { data, error } = await supabase
  .from('invoices')
  .select('*')
  .eq('tenant_id', tenantId)   // OBRIGATÓRIO
  .order('created_at', { ascending: false })
  .range(offset, offset + 49)  // paginação 50 por página
```

---

## Encriptação de API Keys

```typescript
// lib/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(encryptedText: string): string {
  const [ivHex, tagHex, encryptedHex] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

---

## Sistema de Créditos

```typescript
// lib/utils/credits.ts

export async function debitCredits(
  tenantId: string,
  amount: number,
  description: string,
  referenceId: string,
  referenceType: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; balance: number }> {
  // 1. Buscar saldo atual
  const { data: tenant } = await supabase
    .from('tenants')
    .select('credits_balance')
    .eq('id', tenantId)
    .single()

  if (!tenant || tenant.credits_balance < amount) {
    return { success: false, balance: tenant?.credits_balance ?? 0 }
  }

  const newBalance = tenant.credits_balance - amount

  // 2. Atualizar saldo (usar transação RPC para atomicidade)
  await supabase.rpc('debit_credits', {
    p_tenant_id: tenantId,
    p_amount: amount,
    p_description: description,
    p_reference_id: referenceId,
    p_reference_type: referenceType,
  })

  // 3. Verificar alertas
  await checkCreditAlerts(tenantId, newBalance, supabase)

  return { success: true, balance: newBalance }
}
```

---

## Audit Logging

```typescript
// lib/utils/audit.ts

export async function log(
  action: string,
  tenantId: string,
  userId: string | null,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
  supabase: SupabaseClient
) {
  await supabase.from('audit_logs').insert({
    action,
    tenant_id: tenantId,
    user_id: userId,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
  })
}

// Ações a registar SEMPRE:
// invoice.created | invoice.updated | invoice.deleted
// invoice.matched | invoice.unmatched
// project.created | project.updated | project.deleted
// bank.connected | bank.synced
// reconciliation.confirmed | reconciliation.rejected
// ticket.opened | ticket.resolved | ticket.closed
// credits.purchased | credits.consumed | credits.bonus
// user.invited | user.role_changed | user.deactivated
// integration.connected | integration.disconnected
// tenant.branding_updated | tenant.plan_changed
```

---

## Validação de Webhooks

```typescript
// Twilio
import twilio from 'twilio'
const isValid = twilio.validateRequest(
  process.env.TWILIO_AUTH_TOKEN!,
  signature,
  url,
  params
)
if (!isValid) return new Response('Unauthorized', { status: 401 })

// Stripe
import Stripe from 'stripe'
const event = stripe.webhooks.constructEvent(
  body, signature, process.env.STRIPE_WEBHOOK_SECRET!
)

// Resend
import { Webhook } from 'svix'
const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!)
wh.verify(payload, headers)
```

---

## Permissões no Código

```typescript
// lib/utils/permissions.ts

type Resource = 'faturas' | 'projetos' | 'banco' |
  'conciliacao' | 'relatorios' | 'utilizadores' |
  'configuracoes' | 'integracoes' | 'billing' | 'suporte'

type Action = 'view_all' | 'view_own' | 'create' | 'edit' | 'delete'

const PERMISSIONS: Record<string, Record<Resource, Action[]>> = {
  owner: {
    faturas: ['view_all','view_own','create','edit','delete'],
    projetos: ['view_all','view_own','create','edit','delete'],
    banco: ['view_all'],
    conciliacao: ['view_all','create','edit'],
    relatorios: ['view_all'],
    utilizadores: ['view_all','create','edit','delete'],
    configuracoes: ['view_all','edit'],
    integracoes: ['view_all','create','edit','delete'],
    billing: ['view_all','edit'],
    suporte: ['view_all','create'],
  },
  admin: { /* tudo exceto integracoes e billing */ },
  accountant: { /* faturas, banco, conciliacao, relatorios, suporte */ },
  member: { /* faturas.view_own, faturas.create, projetos.view_own, suporte.create */ },
}

export function hasPermission(
  role: string,
  resource: Resource,
  action: Action
): boolean {
  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false
}

// Uso em API routes:
const user = await getCurrentUser(supabase)
if (!hasPermission(user.role, 'banco', 'view_all')) {
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}

// Uso em componentes:
const { role } = usePermissions()
if (!hasPermission(role, 'banco', 'view_all')) return null
```

---

## Branding Dinâmico

```typescript
// app/(dashboard)/layout.tsx
export default async function DashboardLayout({ children }) {
  const supabase = createClient()
  const tenant = await getTenant(supabase)

  return (
    <div
      style={{
        '--color-primary': tenant.primary_color ?? '#2563EB',
      } as React.CSSProperties}
    >
      <Sidebar tenant={tenant} />
      <main>{children}</main>
    </div>
  )
}
```

---

## Supabase Storage — Buckets
Bucket: invoice-files (privado — acesso via signed URL)
→ {tenant_id}/{invoice_id}.{ext}
Bucket: tenant-assets (público)
→ {tenant_id}/logo.{ext}
→ {tenant_id}/favicon.ico
Bucket: ticket-attachments (privado)
→ {tenant_id}/{ticket_id}/{filename}
Bucket: reports (privado — gerado server-side)
→ {tenant_id}/{project_id}/report-{date}.pdf

---

## Comandos de Setup

```bash
# 1. Criar projeto
npx create-next-app@latest isoflow \
  --typescript --tailwind --app --src-dir=false \
  --import-alias="@/*"

# 2. Instalar dependências principais
npm install @supabase/supabase-js @supabase/ssr
npm install @anthropic-ai/sdk
npm install twilio resend stripe
npm install zod react-hook-form @hookform/resolvers
npm install @tanstack/react-table
npm install date-fns sonner lucide-react
npm install class-variance-authority clsx tailwind-merge

# 3. shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card table badge dialog sheet
npx shadcn@latest add form input select textarea label
npx shadcn@latest add dropdown-menu avatar separator tabs
npx shadcn@latest add alert progress command popover
npx shadcn@latest add calendar date-picker

# 4. Supabase CLI
npm install -g supabase
supabase init
supabase db push

# 5. Gerar tipos após migrations
npx supabase gen types typescript \
  --project-id [PROJECT_ID] > types/supabase.ts

# 6. Dev
npm run dev

# 7. Deploy
vercel --prod
```