-- Objetivo mensual único que se usa para todos los vendedores.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS default_monthly_seller_goal INTEGER NOT NULL DEFAULT 400
  CHECK (default_monthly_seller_goal >= 0);
