-- ============================================================================
-- YACELLTECH SALESBOARD — INICIALIZACIÓN EXPLÍCITA Y SEGURA DE DATOS DEMO
-- Archivo: supabase/seed_demo.sql
-- Importante: No mezcla datos de demostración con producción.
-- Verifica que no existan vendedores reales de producción antes de insertar.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.initialize_demo_salesboard(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  prod_sellers_count INTEGER;
  v_carlos UUID;
  v_ana UUID;
  v_luis UUID;
  v_maria UUID;
  v_jose UUID;
BEGIN
  -- Toda llamada requiere una sesión real y autorización de administrador.
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: Solo un administrador puede inicializar la demostración.';
  END IF;

  -- Seguridad: No mezclar con datos de producción
  SELECT COUNT(*) INTO prod_sellers_count
  FROM public.sellers
  WHERE is_demo = FALSE;

  IF prod_sellers_count > 0 THEN
    RAISE EXCEPTION 'Operación bloqueada por seguridad: Ya existen % vendedores de producción. No se permite mezclar datos demo con producción.', prod_sellers_count;
  END IF;

  -- Limpiar datos demo previos si existen
  DELETE FROM public.daily_sales WHERE seller_id IN (SELECT id FROM public.sellers WHERE is_demo = TRUE);
  DELETE FROM public.sellers WHERE is_demo = TRUE;

  -- Configurar Manager General de demostración
  UPDATE public.app_settings
  SET
    store_name = 'YACELLTECH',
    board_title = 'Ranking de ventas',
    manager_name = 'Roberto Méndez',
    manager_label = 'MANAGER GENERAL',
    default_general_goal = 50,
    is_demo_environment = TRUE,
    updated_at = NOW()
  WHERE id = 1;

  -- Insertar los 5 vendedores de ejemplo con colores individuales y metas
  INSERT INTO public.sellers (full_name, avatar_url, bar_color, individual_goal, is_active, show_on_board, display_order, is_demo)
  VALUES
    ('Luis', 'https://api.dicebear.com/9.x/avataaars/svg?seed=LuisYacell&backgroundColor=0ea5e9', '#38BDF8', 15, TRUE, TRUE, 1, TRUE)
  RETURNING id INTO v_luis;

  INSERT INTO public.sellers (full_name, avatar_url, bar_color, individual_goal, is_active, show_on_board, display_order, is_demo)
  VALUES
    ('José', 'https://api.dicebear.com/9.x/avataaars/svg?seed=JoseYacell&backgroundColor=8b5cf6', '#A855F7', 15, TRUE, TRUE, 2, TRUE)
  RETURNING id INTO v_jose;

  INSERT INTO public.sellers (full_name, avatar_url, bar_color, individual_goal, is_active, show_on_board, display_order, is_demo)
  VALUES
    ('Carlos', 'https://api.dicebear.com/9.x/avataaars/svg?seed=CarlosYacell&backgroundColor=10b981', '#10B981', 15, TRUE, TRUE, 3, TRUE)
  RETURNING id INTO v_carlos;

  INSERT INTO public.sellers (full_name, avatar_url, bar_color, individual_goal, is_active, show_on_board, display_order, is_demo)
  VALUES
    ('Ana', 'https://api.dicebear.com/9.x/avataaars/svg?seed=AnaYacell&backgroundColor=ec4899', '#EC4899', 15, TRUE, TRUE, 4, TRUE)
  RETURNING id INTO v_ana;

  INSERT INTO public.sellers (full_name, avatar_url, bar_color, individual_goal, is_active, show_on_board, display_order, is_demo)
  VALUES
    ('María', 'https://api.dicebear.com/9.x/avataaars/svg?seed=MariaYacell&backgroundColor=f97316', '#F97316', 15, TRUE, TRUE, 5, TRUE)
  RETURNING id INTO v_maria;

  -- Meta general para la fecha objetivo (50 equipos)
  INSERT INTO public.daily_goals (goal_date, general_goal)
  VALUES (target_date, 50)
  ON CONFLICT (goal_date) DO UPDATE SET general_goal = EXCLUDED.general_goal;

  -- Ventas del día actual (ejemplo: Carlos 12, Ana 9, Luis 14, María 5, José 11 -> Total: 51 o ejemplo de tabla diaria)
  INSERT INTO public.daily_sales (seller_id, sale_date, units_sold, individual_goal_snapshot)
  VALUES
    (v_carlos, target_date, 12, 15),
    (v_ana, target_date, 9, 15),
    (v_luis, target_date, 15, 15),
    (v_maria, target_date, 5, 15),
    (v_jose, target_date, 11, 15);

  -- Ventas del día anterior (Ayer) para probar filtros históricos y acumulados
  INSERT INTO public.daily_sales (seller_id, sale_date, units_sold, individual_goal_snapshot)
  VALUES
    (v_carlos, target_date - INTERVAL '1 day', 14, 15),
    (v_ana, target_date - INTERVAL '1 day', 10, 15),
    (v_luis, target_date - INTERVAL '1 day', 18, 15),
    (v_maria, target_date - INTERVAL '1 day', 8, 15),
    (v_jose, target_date - INTERVAL '1 day', 16, 15);

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Datos de demostración inicializados correctamente con 5 vendedores.',
    'target_date', target_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_demo_salesboard(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_demo_salesboard(DATE) TO authenticated;
