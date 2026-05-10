-- =============================================
-- MIGRATION 010 — SUPPORT
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
);

CREATE TABLE support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  sender_type text NOT NULL CHECK (sender_type IN ('client','support')),
  message text NOT NULL,
  attachments jsonb DEFAULT '[]',
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
