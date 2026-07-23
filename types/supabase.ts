export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_id: string
          account_name: string | null
          amount: number
          bank_name: string | null
          bank_reference: string | null
          category: string | null
          counterparty_iban: string | null
          counterparty_name: string | null
          created_at: string | null
          currency: string | null
          date: string
          description: string | null
          external_id: string | null
          external_status: string | null
          iban: string | null
          id: string
          invoice_id: string | null
          matched_at: string | null
          matched_by: string | null
          mode: string | null
          notes: string | null
          raw_data: Json | null
          tenant_id: string
          type: string | null
          value_date: string | null
        }
        Insert: {
          account_id: string
          account_name?: string | null
          amount: number
          bank_name?: string | null
          bank_reference?: string | null
          category?: string | null
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string | null
          currency?: string | null
          date: string
          description?: string | null
          external_id?: string | null
          external_status?: string | null
          iban?: string | null
          id?: string
          invoice_id?: string | null
          matched_at?: string | null
          matched_by?: string | null
          mode?: string | null
          notes?: string | null
          raw_data?: Json | null
          tenant_id: string
          type?: string | null
          value_date?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string | null
          amount?: number
          bank_name?: string | null
          bank_reference?: string | null
          category?: string | null
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string | null
          currency?: string | null
          date?: string
          description?: string | null
          external_id?: string | null
          external_status?: string | null
          iban?: string | null
          id?: string
          invoice_id?: string | null
          matched_at?: string | null
          matched_by?: string | null
          mode?: string | null
          notes?: string | null
          raw_data?: Json | null
          tenant_id?: string
          type?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      efatura_documents: {
        Row: {
          at_document_id: string | null
          at_status: string | null
          created_at: string | null
          currency: string | null
          document_date: string | null
          document_number: string | null
          id: string
          invoice_id: string | null
          matched_at: string | null
          matched_by: string | null
          raw_data: Json | null
          subtotal: number | null
          supplier_name: string | null
          supplier_nif: string | null
          tenant_id: string
          toconline_id: string | null
          total: number | null
          updated_at: string | null
          vat_amount: number | null
        }
        Insert: {
          at_document_id?: string | null
          at_status?: string | null
          created_at?: string | null
          currency?: string | null
          document_date?: string | null
          document_number?: string | null
          id?: string
          invoice_id?: string | null
          matched_at?: string | null
          matched_by?: string | null
          raw_data?: Json | null
          subtotal?: number | null
          supplier_name?: string | null
          supplier_nif?: string | null
          tenant_id: string
          toconline_id?: string | null
          total?: number | null
          updated_at?: string | null
          vat_amount?: number | null
        }
        Update: {
          at_document_id?: string | null
          at_status?: string | null
          created_at?: string | null
          currency?: string | null
          document_date?: string | null
          document_number?: string | null
          id?: string
          invoice_id?: string | null
          matched_at?: string | null
          matched_by?: string | null
          raw_data?: Json | null
          subtotal?: number | null
          supplier_name?: string | null
          supplier_nif?: string | null
          tenant_id?: string
          toconline_id?: string | null
          total?: number | null
          updated_at?: string | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "efatura_documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "efatura_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_processing_log: {
        Row: {
          attachments_found: number | null
          attachments_processed: number | null
          details: Json | null
          duplicates_skipped: number | null
          email_message_id: string
          errors: number | null
          from_email: string | null
          id: string
          invoices_created: number | null
          processed_at: string | null
          status: string | null
          subject: string | null
          tenant_id: string
        }
        Insert: {
          attachments_found?: number | null
          attachments_processed?: number | null
          details?: Json | null
          duplicates_skipped?: number | null
          email_message_id: string
          errors?: number | null
          from_email?: string | null
          id?: string
          invoices_created?: number | null
          processed_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_id: string
        }
        Update: {
          attachments_found?: number | null
          attachments_processed?: number | null
          details?: Json | null
          duplicates_skipped?: number | null
          email_message_id?: string
          errors?: number | null
          from_email?: string | null
          id?: string
          invoices_created?: number | null
          processed_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_processing_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_integrations: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string | null
          connected_by: string | null
          created_at: string
          id: string
          refresh_token_encrypted: string | null
          root_folder_id: string | null
          scope: string | null
          sync_error: string | null
          tenant_id: string
          token_expiry: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          refresh_token_encrypted?: string | null
          root_folder_id?: string | null
          scope?: string | null
          sync_error?: string | null
          tenant_id: string
          token_expiry?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          refresh_token_encrypted?: string | null
          root_folder_id?: string | null
          scope?: string | null
          sync_error?: string | null
          tenant_id?: string
          token_expiry?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_integrations_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_drive_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      investidores: {
        Row: {
          capital_disponivel: number
          created_at: string
          email: string
          estado: string
          id: string
          nome: string
          notas: string | null
          tenant_id: string
          tipo_negocio: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          capital_disponivel?: number
          created_at?: string
          email: string
          estado?: string
          id?: string
          nome: string
          notas?: string | null
          tenant_id: string
          tipo_negocio?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          capital_disponivel?: number
          created_at?: string
          email?: string
          estado?: string
          id?: string
          nome?: string
          notas?: string | null
          tenant_id?: string
          tipo_negocio?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investidores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investidores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          ai_attempts: number
          ai_confidence: number | null
          ai_last_attempt_at: string | null
          ai_processed_at: string | null
          ai_raw_response: Json | null
          at_communicated: boolean | null
          at_communicated_at: string | null
          bank_transaction_id: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          document_kind: string
          due_date: string | null
          email_message_id: string | null
          email_subject: string | null
          erp_document_id: string | null
          erp_synced: boolean | null
          erp_synced_at: string | null
          expense_category_code: string | null
          external_id: string | null
          file_hash: string | null
          file_name: string | null
          file_path: string | null
          file_size_bytes: number | null
          file_type: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          match_score: number | null
          matched_at: string | null
          matched_by: string | null
          needs_review: boolean | null
          notes: string | null
          project_id: string | null
          referenced_document_number: string | null
          related_invoice_id: string | null
          sender_email: string | null
          sender_phone: string | null
          sent_by: string | null
          source: string | null
          status: string | null
          subtotal: number | null
          supplier_address: string | null
          supplier_email: string | null
          supplier_name: string | null
          supplier_nif: string | null
          tags: string[] | null
          tenant_id: string
          toconline_fc_id: string | null
          total: number | null
          type: string
          updated_at: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          ai_attempts?: number
          ai_confidence?: number | null
          ai_last_attempt_at?: string | null
          ai_processed_at?: string | null
          ai_raw_response?: Json | null
          at_communicated?: boolean | null
          at_communicated_at?: string | null
          bank_transaction_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          document_kind?: string
          due_date?: string | null
          email_message_id?: string | null
          email_subject?: string | null
          erp_document_id?: string | null
          erp_synced?: boolean | null
          erp_synced_at?: string | null
          expense_category_code?: string | null
          external_id?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          match_score?: number | null
          matched_at?: string | null
          matched_by?: string | null
          needs_review?: boolean | null
          notes?: string | null
          project_id?: string | null
          referenced_document_number?: string | null
          related_invoice_id?: string | null
          sender_email?: string | null
          sender_phone?: string | null
          sent_by?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_address?: string | null
          supplier_email?: string | null
          supplier_name?: string | null
          supplier_nif?: string | null
          tags?: string[] | null
          tenant_id: string
          toconline_fc_id?: string | null
          total?: number | null
          type?: string
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          ai_attempts?: number
          ai_confidence?: number | null
          ai_last_attempt_at?: string | null
          ai_processed_at?: string | null
          ai_raw_response?: Json | null
          at_communicated?: boolean | null
          at_communicated_at?: string | null
          bank_transaction_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          document_kind?: string
          due_date?: string | null
          email_message_id?: string | null
          email_subject?: string | null
          erp_document_id?: string | null
          erp_synced?: boolean | null
          erp_synced_at?: string | null
          expense_category_code?: string | null
          external_id?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          match_score?: number | null
          matched_at?: string | null
          matched_by?: string | null
          needs_review?: boolean | null
          notes?: string | null
          project_id?: string | null
          referenced_document_number?: string | null
          related_invoice_id?: string | null
          sender_email?: string | null
          sender_phone?: string | null
          sent_by?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_address?: string | null
          supplier_email?: string | null
          supplier_name?: string | null
          supplier_nif?: string | null
          tags?: string[] | null
          tenant_id?: string
          toconline_fc_id?: string | null
          total?: number | null
          type?: string
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_snapshots: {
        Row: {
          expenses: number | null
          id: string
          month: number
          revenue: number | null
          saved_at: string | null
          tenant_id: string
          year: number
        }
        Insert: {
          expenses?: number | null
          id?: string
          month: number
          revenue?: number | null
          saved_at?: string | null
          tenant_id: string
          year: number
        }
        Update: {
          expenses?: number | null
          id?: string
          month?: number
          revenue?: number | null
          saved_at?: string | null
          tenant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          drive_file_id: string
          id: string
          mime_type: string | null
          name: string
          project_id: string
          size_bytes: number | null
          tenant_id: string
          uploaded_by: string | null
          visibility: string
          web_view_link: string | null
        }
        Insert: {
          created_at?: string
          drive_file_id: string
          id?: string
          mime_type?: string | null
          name: string
          project_id: string
          size_bytes?: number | null
          tenant_id: string
          uploaded_by?: string | null
          visibility?: string
          web_view_link?: string | null
        }
        Update: {
          created_at?: string
          drive_file_id?: string
          id?: string
          mime_type?: string | null
          name?: string
          project_id?: string
          size_bytes?: number | null
          tenant_id?: string
          uploaded_by?: string | null
          visibility?: string
          web_view_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          parent_id: string | null
          phase: string | null
          phase_order: number | null
          progress: number
          project_id: string
          sort_order: number
          start_date: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          parent_id?: string | null
          phase?: string | null
          phase_order?: number | null
          progress?: number
          project_id: string
          sort_order?: number
          start_date?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          parent_id?: string | null
          phase?: string | null
          phase_order?: number | null
          progress?: number
          project_id?: string
          sort_order?: number
          start_date?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          budget_alert_threshold: number | null
          client_name: string | null
          code: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          drive_folder_id: string | null
          end_date: string | null
          id: string
          location: string | null
          name: string
          name_aliases: string[] | null
          notes: string | null
          start_date: string | null
          status: string | null
          tenant_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          budget_alert_threshold?: number | null
          client_name?: string | null
          code?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drive_folder_id?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name: string
          name_aliases?: string[] | null
          notes?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          budget_alert_threshold?: number | null
          client_name?: string | null
          code?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drive_folder_id?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          name_aliases?: string[] | null
          notes?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_investidores: {
        Row: {
          created_at: string
          id: string
          investidor_id: string
          percentagem: number
          projeto_id: string
          valor_alocado: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          investidor_id: string
          percentagem: number
          projeto_id: string
          valor_alocado?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          investidor_id?: string
          percentagem?: number
          projeto_id?: string
          valor_alocado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_investidores_investidor_id_fkey"
            columns: ["investidor_id"]
            isOneToOne: false
            referencedRelation: "investidores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_investidores_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliations: {
        Row: {
          bank_transaction_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          id: string
          invoice_id: string
          match_score: number | null
          match_type: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          bank_transaction_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          id?: string
          invoice_id: string
          match_score?: number | null
          match_type: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          bank_transaction_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string
          match_score?: number | null
          match_type?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          id: string
          resource: string
          role: string
          tenant_id: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          id?: string
          resource: string
          role: string
          tenant_id?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          id?: string
          resource?: string
          role?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          credits_monthly: number
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          price_monthly: number
          status: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          credits_monthly: number
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan: string
          price_monthly: number
          status?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          credits_monthly?: number
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          price_monthly?: number
          status?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachments: Json | null
          created_at: string | null
          id: string
          is_internal: boolean | null
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string | null
          created_by: string
          credits_charged: number | null
          description: string
          first_response_at: string | null
          id: string
          priority: string | null
          resolved_at: string | null
          satisfaction_rating: number | null
          status: string | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          created_by: string
          credits_charged?: number | null
          description: string
          first_response_at?: string | null
          id?: string
          priority?: string | null
          resolved_at?: string | null
          satisfaction_rating?: number | null
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string
          credits_charged?: number | null
          description?: string
          first_response_at?: string | null
          id?: string
          priority?: string | null
          resolved_at?: string | null
          satisfaction_rating?: number | null
          status?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          provider: string
          sync_error: string | null
          sync_locked_until: string | null
          tenant_id: string
          toconline_client_id: string | null
          toconline_client_secret_encrypted: string | null
          toconline_token_expires_at: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          provider: string
          sync_error?: string | null
          sync_locked_until?: string | null
          tenant_id: string
          toconline_client_id?: string | null
          toconline_client_secret_encrypted?: string | null
          toconline_token_expires_at?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          provider?: string
          sync_error?: string | null
          sync_locked_until?: string | null
          tenant_id?: string
          toconline_client_id?: string | null
          toconline_client_secret_encrypted?: string | null
          toconline_token_expires_at?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          role: string
          status: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          status?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          status?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          app_name: string | null
          auto_erp_send: boolean | null
          billing_cycle: string | null
          created_at: string | null
          credits_balance: number | null
          credits_used_this_month: number | null
          email: string | null
          favicon_path: string | null
          id: string
          integration_mode: string | null
          internal_notes: string | null
          logo_path: string | null
          logo_url: string | null
          name: string
          next_billing_date: string | null
          nif: string | null
          onboarding_completed: boolean | null
          phone: string | null
          plan: string | null
          primary_color: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          toconline_revenue_cached_at: string | null
          toconline_revenue_month: number | null
          toconline_revenue_total: number | null
          toconline_revenue_year: number | null
          trial_ends_at: string | null
          updated_at: string | null
          vat_regime: string | null
        }
        Insert: {
          address?: string | null
          app_name?: string | null
          auto_erp_send?: boolean | null
          billing_cycle?: string | null
          created_at?: string | null
          credits_balance?: number | null
          credits_used_this_month?: number | null
          email?: string | null
          favicon_path?: string | null
          id?: string
          integration_mode?: string | null
          internal_notes?: string | null
          logo_path?: string | null
          logo_url?: string | null
          name: string
          next_billing_date?: string | null
          nif?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          plan?: string | null
          primary_color?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          toconline_revenue_cached_at?: string | null
          toconline_revenue_month?: number | null
          toconline_revenue_total?: number | null
          toconline_revenue_year?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          vat_regime?: string | null
        }
        Update: {
          address?: string | null
          app_name?: string | null
          auto_erp_send?: boolean | null
          billing_cycle?: string | null
          created_at?: string | null
          credits_balance?: number | null
          credits_used_this_month?: number | null
          email?: string | null
          favicon_path?: string | null
          id?: string
          integration_mode?: string | null
          internal_notes?: string | null
          logo_path?: string | null
          logo_url?: string | null
          name?: string
          next_billing_date?: string | null
          nif?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          plan?: string | null
          primary_color?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          toconline_revenue_cached_at?: string | null
          toconline_revenue_month?: number | null
          toconline_revenue_total?: number | null
          toconline_revenue_year?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          vat_regime?: string | null
        }
        Relationships: []
      }
      toconline_expense_categories: {
        Row: {
          code: string
          id: string
          is_main: boolean | null
          name: string
          synced_at: string | null
          tax_code: string | null
          tax_deductibility: number | null
          tenant_id: string
        }
        Insert: {
          code: string
          id?: string
          is_main?: boolean | null
          name: string
          synced_at?: string | null
          tax_code?: string | null
          tax_deductibility?: number | null
          tenant_id: string
        }
        Update: {
          code?: string
          id?: string
          is_main?: boolean | null
          name?: string
          synced_at?: string | null
          tax_code?: string | null
          tax_deductibility?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toconline_expense_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      unmatched_emails: {
        Row: {
          assigned_to_tenant_id: string | null
          attachment_path: string | null
          created_at: string | null
          from_email: string
          id: string
          raw_data: Json | null
          received_at: string | null
          status: string | null
          subject: string | null
        }
        Insert: {
          assigned_to_tenant_id?: string | null
          attachment_path?: string | null
          created_at?: string | null
          from_email: string
          id?: string
          raw_data?: Json | null
          received_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          assigned_to_tenant_id?: string | null
          attachment_path?: string | null
          created_at?: string | null
          from_email?: string
          id?: string
          raw_data?: Json | null
          received_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unmatched_emails_assigned_to_tenant_id_fkey"
            columns: ["assigned_to_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          name: string
          role: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          name: string
          role?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          name?: string
          role?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_email_sync_lock: {
        Args: { p_integration_id: string; p_lock_until: string }
        Returns: boolean
      }
      get_investidor_id: { Args: never; Returns: string }
      get_invoices_with_efatura: {
        Args: { p_tenant_id: string; p_user_id?: string }
        Returns: {
          at_communicated: boolean
          currency: string
          efatura_at_status: string
          efatura_doc_id: string
          efatura_doc_number: string
          id: string
          invoice_date: string
          invoice_number: string
          source: string
          status: string
          supplier_name: string
          supplier_nif: string
          toconline_fc_id: string
          total: number
        }[]
      }
      get_user_role: { Args: never; Returns: string }
      get_user_tenant_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
