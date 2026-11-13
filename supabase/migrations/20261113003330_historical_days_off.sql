-- El horario vigente se registra desde hoy; no se inventan horarios anteriores.
CREATE TABLE public.seller_weekly_days_off_history (
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  weekday smallint CHECK (weekday BETWEEN 1 AND 7),
  PRIMARY KEY (seller_id, effective_date)
);
ALTER TABLE public.seller_weekly_days_off_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_weekly_days_off_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seller_weekly_days_off_history TO authenticated;
CREATE POLICY days_off_history_admin_read ON public.seller_weekly_days_off_history
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

INSERT INTO public.seller_weekly_days_off_history (seller_id, effective_date, weekday)
SELECT s.id, (now() AT TIME ZONE 'America/Santo_Domingo')::date, w.weekday
FROM public.sellers s LEFT JOIN public.seller_weekly_days_off w ON w.seller_id = s.id
WHERE NOT s.is_manager;

CREATE FUNCTION public.record_weekly_day_off_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.seller_weekly_days_off_history (seller_id, effective_date, weekday)
  VALUES (NEW.seller_id, (now() AT TIME ZONE 'America/Santo_Domingo')::date, NEW.weekday)
  ON CONFLICT (seller_id, effective_date) DO UPDATE SET weekday = EXCLUDED.weekday;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_weekly_day_off_history() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_weekly_day_off_history AFTER INSERT OR UPDATE ON public.seller_weekly_days_off
FOR EACH ROW EXECUTE FUNCTION public.record_weekly_day_off_history();
NOTIFY pgrst, 'reload schema';
