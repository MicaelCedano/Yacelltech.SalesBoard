-- Las fotos del tablero siguen accesibles por URL pública; listar el bucket requiere admin.
DROP POLICY IF EXISTS "Avatars: acceso público de lectura" ON storage.objects;
CREATE POLICY "Avatars: listado solo admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (SELECT public.is_admin()));

-- Supabase puede instalar este event trigger al activar RLS automático.
-- Su ejecución interna no necesita permisos de los clientes de la Data API.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;
