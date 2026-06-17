-- Configuração por tenant: envio automático ao ERP quando fatura chega sem revisão
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_erp_send boolean DEFAULT false NOT NULL;
