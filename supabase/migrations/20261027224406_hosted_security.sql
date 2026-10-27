-- Permisos explícitos para el primer despliegue alojado.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_salesboard_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin' AND is_active = TRUE
  );
$$;
REVOKE ALL ON FUNCTION private.is_salesboard_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_salesboard_admin() TO anon, authenticated;

-- Las políticas existentes conservan la misma interfaz pública, sin privilegios elevados.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.is_salesboard_admin(); $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- El trigger conserva su referencia al mover la función al esquema privado.
ALTER FUNCTION public.handle_new_user() SET SCHEMA private;
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Administrador'), 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER VIEW public.public_board_sellers SET (security_invoker = true);
ALTER VIEW public.public_board_daily_sales SET (security_invoker = true);

REVOKE ALL ON TABLE public.profiles, public.audit_logs,
  public.app_settings, public.sellers, public.daily_goals, public.daily_sales,
  public.public_board_sellers, public.public_board_daily_sales FROM anon, authenticated;

GRANT SELECT ON public.app_settings, public.sellers, public.daily_goals, public.daily_sales,
  public.public_board_sellers, public.public_board_daily_sales TO anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings, public.sellers,
  public.daily_goals, public.daily_sales TO authenticated;

-- RLS sigue verificando public.is_admin() en cada escritura y en la auditoría privada.
NOTIFY pgrst, 'reload schema';
