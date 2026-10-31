-- ============================================================================
-- PURGA DE HISTORIAL DE PRUEBAS
-- Elimina registros de prueba anteriores al 30 de octubre de 2026,
-- conservando intactos los datos reales ingresados a partir del 30 de octubre.
-- ============================================================================

DELETE FROM public.daily_sales
WHERE sale_date < '2026-10-30';

DELETE FROM public.daily_goals
WHERE goal_date < '2026-10-30'
  AND goal_date <> '2099-12-31';

DELETE FROM public.audit_logs
WHERE sale_date < '2026-10-30';
