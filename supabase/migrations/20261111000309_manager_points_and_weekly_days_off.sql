ALTER TABLE public.sellers
  ADD COLUMN is_manager BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT manager_is_hidden CHECK (NOT is_manager OR NOT show_on_board);

CREATE UNIQUE INDEX sellers_one_manager ON public.sellers (is_manager)
  WHERE is_manager;

INSERT INTO public.sellers (full_name, individual_goal, show_on_board, is_manager)
VALUES ('Manager General', 0, FALSE, TRUE);

CREATE TABLE public.seller_weekly_days_off (
  seller_id UUID PRIMARY KEY REFERENCES public.sellers(id) ON DELETE CASCADE,
  weekday SMALLINT CHECK (weekday BETWEEN 1 AND 7)
);

ALTER TABLE public.seller_weekly_days_off ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_weekly_days_off FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.seller_weekly_days_off TO authenticated;
GRANT ALL ON public.seller_weekly_days_off TO service_role;

CREATE POLICY "Administrar días libres" ON public.seller_weekly_days_off
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK (
    (SELECT public.is_admin()) AND EXISTS (
      SELECT 1 FROM public.sellers
      WHERE id = seller_id AND NOT is_manager
    )
  );

-- Días semanales ISO, lunes = 1 y domingo = 7. Aplicar solo a nombres activos inequívocos.
WITH initial_days (name, weekday) AS (
  VALUES ('pamela', 7), ('cristy', 5), ('hamelys', 4), ('brenda', 1),
         ('yrismer', 7), ('otoniel', 7), ('greimy', 7), ('samuel', 3)
), matches AS (
  SELECT seller.id, initial_days.weekday,
         COUNT(*) OVER (PARTITION BY initial_days.name) AS matches
  FROM initial_days
  JOIN public.sellers AS seller ON lower(btrim(seller.full_name)) = initial_days.name
  WHERE seller.is_active AND NOT seller.is_demo AND NOT seller.is_manager
)
INSERT INTO public.seller_weekly_days_off (seller_id, weekday)
SELECT id, weekday FROM matches WHERE matches = 1
ON CONFLICT (seller_id) DO NOTHING;
