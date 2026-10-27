-- ============================================================================
-- YACELLTECH SALESBOARD — MIGRACIÓN INICIAL DE BASE DE DATOS (SUPABASE)
-- Archivo: supabase/migrations/0001_initial_schema.sql
-- ============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLA: profiles (Administradores y roles verificados en el servidor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Administrador YacellTech',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role) WHERE is_active = TRUE;

-- Función segura en servidor para verificar rol de administrador (nunca confía en el cliente)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
  );
$$;

-- Trigger automático cuando se crea un usuario desde el panel de Supabase
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Administrador'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. TABLA: app_settings (Configuración global y Manager General)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name TEXT NOT NULL DEFAULT 'YACELLTECH',
  board_title TEXT NOT NULL DEFAULT 'Ranking de ventas',
  manager_name TEXT NOT NULL DEFAULT 'Roberto Méndez',
  manager_label TEXT NOT NULL DEFAULT 'MANAGER GENERAL',
  manager_avatar_url TEXT,
  default_general_goal INTEGER NOT NULL DEFAULT 50 CHECK (default_general_goal >= 0),
  timezone TEXT NOT NULL DEFAULT 'America/Santo_Domingo',
  is_demo_environment BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_settings (
  id, store_name, board_title, manager_name, manager_label, default_general_goal, timezone
) VALUES (
  1, 'YACELLTECH', 'Ranking de ventas', 'Roberto Méndez', 'MANAGER GENERAL', 50, 'America/Santo_Domingo'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. TABLA: sellers (Vendedores de YacellTech)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  avatar_url TEXT,
  bar_color TEXT NOT NULL DEFAULT '#0EA5E9',
  individual_goal INTEGER NOT NULL DEFAULT 15 CHECK (individual_goal >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_board BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sellers_active_board ON public.sellers(is_active, show_on_board, display_order);

-- ============================================================================
-- 4. TABLA: daily_goals (Meta general por fecha específica)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_date DATE NOT NULL UNIQUE,
  general_goal INTEGER NOT NULL CHECK (general_goal >= 0),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_goals_date ON public.daily_goals(goal_date);

-- ============================================================================
-- 5. TABLA: daily_sales (Equipos vendidos por vendedor y fecha)
-- Restricción única por vendedor y fecha; enteros no negativos.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
  sale_date DATE NOT NULL,
  units_sold INTEGER NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
  individual_goal_snapshot INTEGER NOT NULL DEFAULT 15 CHECK (individual_goal_snapshot >= 0),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_daily_sales_seller_date UNIQUE (seller_id, sale_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_sale_date ON public.daily_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_seller_date ON public.daily_sales(seller_id, sale_date);

-- ============================================================================
-- 6. TABLA: audit_logs (Historial de cambios y auditoría administrativa)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL DEFAULT 'admin@yacelltech.com',
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  sale_date DATE,
  previous_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_sale_date ON public.audit_logs(sale_date);

-- ============================================================================
-- 7. VISTA PÚBLICA SEGURA (Exposición mínima de campos para la pantalla pública)
-- ============================================================================
CREATE OR REPLACE VIEW public.public_board_sellers AS
SELECT
  id,
  full_name,
  avatar_url,
  bar_color,
  individual_goal,
  is_active,
  show_on_board,
  display_order
FROM public.sellers
WHERE is_active = TRUE;

CREATE OR REPLACE VIEW public.public_board_daily_sales AS
SELECT
  seller_id,
  sale_date,
  units_sold,
  individual_goal_snapshot,
  updated_at
FROM public.daily_sales;

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles (Solo lectura del propio perfil o administradores)
DROP POLICY IF EXISTS "Profiles: lectura propia o admin" ON public.profiles;
CREATE POLICY "Profiles: lectura propia o admin"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Profiles: actualización solo admin" ON public.profiles;
CREATE POLICY "Profiles: actualización solo admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para app_settings (Lectura pública para el tablero, escritura solo admin)
DROP POLICY IF EXISTS "AppSettings: lectura pública" ON public.app_settings;
CREATE POLICY "AppSettings: lectura pública"
  ON public.app_settings FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "AppSettings: modificación solo admin" ON public.app_settings;
CREATE POLICY "AppSettings: modificación solo admin"
  ON public.app_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para sellers (Lectura pública de vendedores, escritura solo admin)
DROP POLICY IF EXISTS "Sellers: lectura pública" ON public.sellers;
CREATE POLICY "Sellers: lectura pública"
  ON public.sellers FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Sellers: modificación solo admin" ON public.sellers;
CREATE POLICY "Sellers: modificación solo admin"
  ON public.sellers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para daily_goals (Lectura pública, escritura solo admin)
DROP POLICY IF EXISTS "DailyGoals: lectura pública" ON public.daily_goals;
CREATE POLICY "DailyGoals: lectura pública"
  ON public.daily_goals FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "DailyGoals: modificación solo admin" ON public.daily_goals;
CREATE POLICY "DailyGoals: modificación solo admin"
  ON public.daily_goals FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para daily_sales (Lectura pública para cálculo exacto y barras, escritura solo admin)
DROP POLICY IF EXISTS "DailySales: lectura pública" ON public.daily_sales;
CREATE POLICY "DailySales: lectura pública"
  ON public.daily_sales FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "DailySales: modificación solo admin" ON public.daily_sales;
CREATE POLICY "DailySales: modificación solo admin"
  ON public.daily_sales FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para audit_logs (ESTRICTAMENTE PRIVADO: solo administradores autenticados)
DROP POLICY IF EXISTS "AuditLogs: lectura solo admin" ON public.audit_logs;
CREATE POLICY "AuditLogs: lectura solo admin"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "AuditLogs: inserción solo admin" ON public.audit_logs;
CREATE POLICY "AuditLogs: inserción solo admin"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 9. STORAGE BUCKET PARA FOTOGRAFÍAS (avatars)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  5242880, -- 5MB límite
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatars: acceso público de lectura" ON storage.objects;
CREATE POLICY "Avatars: acceso público de lectura"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars: subida solo por administradores" ON storage.objects;
CREATE POLICY "Avatars: subida solo por administradores"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());

DROP POLICY IF EXISTS "Avatars: actualización solo por administradores" ON storage.objects;
CREATE POLICY "Avatars: actualización solo por administradores"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND public.is_admin())
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());

DROP POLICY IF EXISTS "Avatars: eliminación solo por administradores" ON storage.objects;
CREATE POLICY "Avatars: eliminación solo por administradores"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND public.is_admin());

-- ============================================================================
-- 10. CONFIGURACIÓN DE SUPABASE REALTIME (Solo tablas públicas del tablero)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'daily_sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_sales;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'daily_goals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_goals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sellers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sellers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'app_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
  END IF;
END $$;
