CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Excepciones por fecha: false permite trabajar en un día libre semanal.
CREATE TABLE public.seller_day_off_overrides (
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  off_date date NOT NULL,
  is_off boolean NOT NULL,
  PRIMARY KEY (seller_id, off_date)
);
ALTER TABLE public.seller_day_off_overrides ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_day_off_overrides TO authenticated;
CREATE POLICY day_off_admin ON public.seller_day_off_overrides FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- Sólo expone los identificadores libres hoy; no publica los horarios semanales.
CREATE FUNCTION public.board_days_off_today() RETURNS TABLE(seller_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id FROM public.sellers s
  LEFT JOIN public.seller_weekly_days_off w ON w.seller_id = s.id
  LEFT JOIN public.seller_day_off_overrides o ON o.seller_id = s.id
    AND o.off_date = (now() AT TIME ZONE 'America/Santo_Domingo')::date
  WHERE s.is_active AND s.show_on_board AND NOT s.is_manager
    AND COALESCE(o.is_off, w.weekday = EXTRACT(ISODOW FROM (now() AT TIME ZONE 'America/Santo_Domingo'))::int, false);
$$;
REVOKE ALL ON FUNCTION public.board_days_off_today() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.board_days_off_today() TO anon, authenticated;

CREATE TABLE public.leadership_daily_closures (
  closure_date date PRIMARY KEY,
  leader_ids uuid[] NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leadership_daily_closures ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.leadership_daily_closures TO anon, authenticated;
CREATE POLICY leadership_public_read ON public.leadership_daily_closures FOR SELECT TO anon, authenticated USING (true);

-- El cierre se toma sólo durante los primeros cinco minutos del día siguiente.
-- Si falta un cierre, no se reconstruye a partir de datos que pueden haber sido editados.
CREATE FUNCTION public.close_daily_leadership() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  local_now timestamp := now() AT TIME ZONE 'America/Santo_Domingo';
  close_date date := (now() AT TIME ZONE 'America/Santo_Domingo')::date - 1;
  cycle_date date;
  marker integer;
  leaders uuid[];
BEGIN
  IF local_now::time >= time '00:05:00' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.leadership_daily_closures WHERE closure_date = close_date) THEN RETURN; END IF;
  SELECT general_goal INTO marker FROM public.daily_goals WHERE goal_date = date '1970-01-01';
  BEGIN
    cycle_date := to_date(marker::text, 'YYYYMMDD');
    IF to_char(cycle_date, 'YYYYMMDD') <> marker::text OR cycle_date > close_date THEN cycle_date := NULL; END IF;
  EXCEPTION WHEN OTHERS THEN cycle_date := NULL;
  END;
  cycle_date := COALESCE(cycle_date, date_trunc('month', close_date)::date);
  WITH totals AS (
    SELECT s.id, COALESCE(sum(d.units_sold), 0) AS points
    FROM public.sellers s LEFT JOIN public.daily_sales d ON d.seller_id = s.id
      AND d.sale_date BETWEEN cycle_date AND close_date
    WHERE s.is_active AND s.show_on_board AND NOT s.is_manager
    GROUP BY s.id
  ), best AS (SELECT max(points) AS points FROM totals)
  SELECT COALESCE(array_agg(t.id ORDER BY t.id), ARRAY[]::uuid[]) INTO leaders
  FROM totals t CROSS JOIN best b WHERE t.points = b.points AND t.points > 0;
  INSERT INTO public.leadership_daily_closures (closure_date, leader_ids)
  VALUES (close_date, leaders) ON CONFLICT (closure_date) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.close_daily_leadership() FROM PUBLIC, anon, authenticated;
-- Santo Domingo currently remains UTC-4; the function independently verifies local midnight.
SELECT cron.schedule('salesboard-leadership-close', '0 4 * * *', 'SELECT public.close_daily_leadership()');
NOTIFY pgrst, 'reload schema';
