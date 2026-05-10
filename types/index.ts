// =============================================
// ISOFlow — Tipos partilhados
// Espelham o schema das migrations em supabase/migrations
// =============================================

// ---------- Enums ----------

export type TenantPlan = "starter" | "business" | "pro" | "enterprise"
export type TenantStatus = "trial" | "active" | "suspended" | "cancelled"

export type UserRole = "owner" | "admin" | "accountant" | "member"

export type IntegrationType = "erp" | "banking" | "whatsapp" | "email"

export type ProjectType =
  | "obra"
  | "projeto"
  | "departamento"
  | "cliente"
  | "outro"
export type ProjectStatus = "active" | "completed" | "paused" | "cancelled"

export type InvoiceType = "incoming" | "outgoing"
export type InvoiceStatus =
  | "pending"
  | "processing"
  | "matched"
  | "paid"
  | "rejected"
  | "duplicate"
export type InvoiceSource = "whatsapp" | "email" | "manual" | "api" | "erp"
export type InvoiceFileType = "pdf" | "jpg" | "jpeg" | "png"
export type InvoiceMatchedBy = "auto" | "manual"

export type BankTransactionType = "debit" | "credit"

export type ReconciliationMatchType = "auto" | "manual"
export type ReconciliationStatus = "confirmed" | "pending" | "rejected"

export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "past_due"
  | "trialing"

export type CreditTransactionType =
  | "purchase"
  | "usage"
  | "refund"
  | "bonus"
  | "monthly_reset"

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_client"
  | "resolved"
  | "closed"
export type SupportTicketPriority = "low" | "medium" | "high" | "urgent"
export type SupportTicketCategory =
  | "billing"
  | "technical"
  | "integration"
  | "invoice"
  | "banking"
  | "other"
export type SupportMessageSenderType = "client" | "support"

// ---------- Tabelas ----------

export interface Tenant {
  id: string
  name: string
  nif: string | null
  email: string | null
  phone: string | null
  address: string | null
  plan: TenantPlan
  credits_balance: number
  credits_used_this_month: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: TenantStatus
  trial_ends_at: string | null
  onboarding_completed: boolean
  logo_path: string | null
  logo_url: string | null
  favicon_path: string | null
  primary_color: string
  app_name: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  tenant_id: string
  name: string
  email: string
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface TenantIntegration {
  id: string
  tenant_id: string
  type: IntegrationType
  provider: string
  api_key_encrypted: string | null
  api_secret_encrypted: string | null
  config: Record<string, unknown>
  is_active: boolean
  last_sync_at: string | null
  sync_error: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  tenant_id: string
  name: string
  code: string | null
  description: string | null
  type: ProjectType
  status: ProjectStatus
  budget: number | null
  budget_alert_threshold: number
  start_date: string | null
  end_date: string | null
  color: string
  client_name: string | null
  location: string | null
  notes: string | null
  name_aliases: string[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  tenant_id: string
  created_at: string
}

export interface Invoice {
  id: string
  tenant_id: string
  project_id: string | null
  external_id: string | null
  type: InvoiceType
  status: InvoiceStatus
  supplier_name: string | null
  supplier_nif: string | null
  supplier_email: string | null
  supplier_address: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  vat_rate: number | null
  vat_amount: number | null
  total: number | null
  currency: string
  description: string | null
  category: string | null
  source: InvoiceSource
  sent_by: string | null
  sender_phone: string | null
  sender_email: string | null
  file_path: string | null
  file_name: string | null
  file_type: InvoiceFileType | null
  file_size_bytes: number | null
  bank_transaction_id: string | null
  matched_at: string | null
  matched_by: InvoiceMatchedBy | null
  match_score: number | null
  ai_confidence: number | null
  ai_raw_response: Record<string, unknown> | null
  ai_processed_at: string | null
  needs_review: boolean
  erp_synced: boolean
  erp_synced_at: string | null
  erp_document_id: string | null
  at_communicated: boolean
  at_communicated_at: string | null
  notes: string | null
  tags: string[] | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  total: number
}

export interface InvoiceExtraction {
  supplier_name: string | null
  supplier_nif: string | null
  supplier_email: string | null
  supplier_address: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  vat_rate: number | null
  vat_amount: number | null
  total: number | null
  currency: "EUR"
  description: string | null
  category:
    | "transporte"
    | "alimentacao"
    | "tecnologia"
    | "servicos"
    | "material"
    | "combustivel"
    | "comunicacoes"
    | "alojamento"
    | "formacao"
    | "outro"
  line_items: InvoiceLineItem[]
  confidence: number
  needs_review: boolean
  notes: string | null
}

export interface BankTransaction {
  id: string
  tenant_id: string
  account_id: string
  account_name: string | null
  bank_name: string | null
  iban: string | null
  external_id: string | null
  date: string
  value_date: string | null
  amount: number
  currency: string
  description: string | null
  type: BankTransactionType | null
  category: string | null
  mode: string | null
  invoice_id: string | null
  matched_at: string | null
  matched_by: InvoiceMatchedBy | null
  raw_data: Record<string, unknown> | null
  created_at: string
}

export interface Reconciliation {
  id: string
  tenant_id: string
  invoice_id: string
  bank_transaction_id: string
  match_type: ReconciliationMatchType
  match_score: number | null
  status: ReconciliationStatus
  confirmed_by: string | null
  confirmed_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  created_at: string
}

export interface Subscription {
  id: string
  tenant_id: string
  plan: string
  price_monthly: number
  credits_monthly: number
  status: SubscriptionStatus
  stripe_subscription_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  tenant_id: string
  amount: number
  type: CreditTransactionType
  description: string | null
  reference_id: string | null
  reference_type: string | null
  balance_after: number
  created_at: string
}

export interface SupportTicket {
  id: string
  tenant_id: string
  created_by: string
  assigned_to: string | null
  title: string
  description: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: SupportTicketCategory | null
  credits_charged: number
  first_response_at: string | null
  resolved_at: string | null
  satisfaction_rating: number | null
  created_at: string
  updated_at: string
}

export interface SupportMessage {
  id: string
  ticket_id: string
  sender_id: string
  sender_type: SupportMessageSenderType
  message: string
  attachments: SupportAttachment[]
  is_internal: boolean
  created_at: string
}

export interface SupportAttachment {
  name: string
  url: string
  size_bytes?: number
  content_type?: string
}

export interface AuditLog {
  id: string
  tenant_id: string
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface RolePermission {
  id: string
  tenant_id: string | null
  role: UserRole
  resource: string
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}
