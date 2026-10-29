-- El Manager General tiene un objetivo mensual propio, configurable y separado
-- de la meta mensual compartida por los vendedores.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS default_monthly_manager_goal INTEGER NOT NULL DEFAULT 1000
  CHECK (default_monthly_manager_goal >= 0);
