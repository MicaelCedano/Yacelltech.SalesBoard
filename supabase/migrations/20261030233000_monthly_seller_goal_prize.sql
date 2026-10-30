-- Premio configurable para la meta mensual compartida de los vendedores (texto y valor en RD$).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS monthly_seller_prize_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS monthly_seller_prize_value INTEGER NOT NULL DEFAULT 0
    CHECK (monthly_seller_prize_value >= 0);
