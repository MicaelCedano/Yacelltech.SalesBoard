-- Los puntos se registran por fecha; las metas se configuran solo por mes.
-- Se conserva la firma anterior para los clientes abiertos durante el despliegue.
-- p_general_goal y las metas de p_entries solo intervienen en la huella de reintentos.
CREATE OR REPLACE FUNCTION public.apply_daily_points(
  p_request_id uuid, p_sale_date date, p_general_goal integer,
  p_entries jsonb, p_mode text DEFAULT 'add'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_request jsonb;
  v_existing_request public.audit_logs%ROWTYPE;
  v_entry jsonb;
  v_seller public.sellers%ROWTYPE;
  v_sale public.daily_sales%ROWTYPE;
  v_previous integer;
  v_next integer;
  v_points integer;
  v_actor_email text;
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
  v_count integer := 0;
BEGIN
  IF NOT public.is_admin() OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_sale_date IS NULL OR p_mode IS NULL OR p_mode NOT IN ('add', 'set')
     OR p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'Datos de puntos inválidos' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_entries) NOT BETWEEN 1 AND 500
     OR (SELECT count(DISTINCT e->>'seller_id') FROM jsonb_array_elements(p_entries) e) <> jsonb_array_length(p_entries) THEN
    RAISE EXCEPTION 'Vendedores vacíos o duplicados' USING ERRCODE = '22023';
  END IF;
  v_request := jsonb_build_object('sale_date', p_sale_date, 'general_goal', p_general_goal, 'mode', p_mode, 'entries', p_entries);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  SELECT * INTO v_existing_request FROM public.audit_logs WHERE id = p_request_id;
  IF FOUND THEN
    IF v_existing_request.actor_id IS DISTINCT FROM auth.uid()
       OR v_existing_request.new_values->'request' IS DISTINCT FROM v_request THEN
      RAISE EXCEPTION 'CONFLICT: Esta operación ya existe con otros datos.';
    END IF;
    RETURN jsonb_build_object('updatedCount', jsonb_array_length(v_existing_request.new_values->'sellers'), 'replayed', true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('salesboard-day:' || p_sale_date::text, 0));
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();
  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_entries) ORDER BY value->>'seller_id'
  LOOP
    IF (v_entry->>'units_sold') IS NULL OR (v_entry->>'units_sold') !~ '^\d+$' THEN
      RAISE EXCEPTION 'Los puntos deben ser enteros no negativos' USING ERRCODE = '22023';
    END IF;
    v_points := (v_entry->>'units_sold')::integer;
    IF v_points > 100000 THEN
      RAISE EXCEPTION 'El valor excede 100000 puntos' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_seller FROM public.sellers WHERE id = (v_entry->>'seller_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vendedor no encontrado' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_sale FROM public.daily_sales WHERE seller_id = v_seller.id AND sale_date = p_sale_date FOR UPDATE;
    v_previous := COALESCE(v_sale.units_sold, 0);
    IF p_mode = 'set' AND COALESCE((v_entry->>'expected_version')::integer, -1) <> COALESCE(v_sale.version, 0) THEN
      RAISE EXCEPTION 'CONFLICT: Los puntos de % cambiaron. Recarga antes de corregir.', v_seller.full_name;
    END IF;
    v_next := CASE WHEN p_mode = 'add' THEN v_previous + v_points ELSE v_points END;
    IF v_next > 100000 THEN RAISE EXCEPTION 'El total diario no puede exceder 100000 puntos' USING ERRCODE = '22023'; END IF;
    IF v_sale.id IS NULL OR v_next <> v_previous THEN
      v_before := v_before || jsonb_build_array(jsonb_build_object('seller_id', v_seller.id, 'seller_name', v_seller.full_name, 'units_sold', v_previous));
      v_after := v_after || jsonb_build_array(jsonb_build_object('seller_id', v_seller.id, 'seller_name', v_seller.full_name, 'units_sold', v_next));
      INSERT INTO public.daily_sales (seller_id, sale_date, units_sold, individual_goal_snapshot, updated_by)
      VALUES (v_seller.id, p_sale_date, v_next, 0, auth.uid())
      ON CONFLICT (seller_id, sale_date) DO UPDATE SET units_sold = EXCLUDED.units_sold,
        version = public.daily_sales.version + 1, updated_by = auth.uid(), updated_at = now();
      v_count := v_count + 1;
    END IF;
  END LOOP;
  INSERT INTO public.audit_logs (id, actor_id, actor_email, action_type, entity_type, entity_id, sale_date, previous_values, new_values)
  VALUES (p_request_id, auth.uid(), COALESCE(v_actor_email, ''), 'BATCH_DAILY_SALES_UPDATE', 'daily_sales', p_sale_date::text, p_sale_date,
    jsonb_build_object('sellers', v_before), jsonb_build_object('sellers', v_after, 'request', v_request));
  RETURN jsonb_build_object('updatedCount', v_count, 'replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_daily_points(uuid, date, integer, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_daily_points(uuid, date, integer, jsonb, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
