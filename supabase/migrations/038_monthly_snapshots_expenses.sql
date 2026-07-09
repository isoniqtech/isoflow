-- Adiciona coluna expenses a monthly_snapshots
-- Permite guardar gastos mensais (incoming) vindos do TOConline via n8n
-- Mirroring do modelo de receita (revenue) ja existente

ALTER TABLE monthly_snapshots
  ADD COLUMN IF NOT EXISTS expenses numeric(12,2) DEFAULT 0;
