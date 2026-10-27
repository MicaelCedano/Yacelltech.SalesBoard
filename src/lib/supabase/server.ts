import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/supabase/env";

export async function getSupabaseServerClient() {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // En Server Components de solo lectura, setAll puede ser ignorado de forma segura
        }
      },
    },
  });
}

/**
 * Verifica en el servidor que el usuario esté autenticado en Supabase Auth
 * y tenga el rol 'admin' activo en la tabla `profiles` (nunca confía en claims del navegador).
 */
export async function verifyServerAdminSession(): Promise<{
  isAdmin: boolean;
  userId: string | null;
  email: string | null;
  mode: "supabase" | "demo-local";
}> {
  const supabase = await getSupabaseServerClient();

  // Si Supabase está configurado, exigir sesión real y rol 'admin' en base de datos
  if (supabase) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { isAdmin: false, userId: null, email: null, mode: "supabase" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, role, is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin" || !profile.is_active) {
      return {
        isAdmin: false,
        userId: user.id,
        email: user.email ?? null,
        mode: "supabase",
      };
    }

    return {
      isAdmin: true,
      userId: profile.id,
      email: profile.email || user.email || "admin@yacelltech.com",
      mode: "supabase",
    };
  }

  // Modo de demostración local (solo cuando Supabase aún no tiene credenciales configuradas)
  const cookieStore = await cookies();
  const demoSession = cookieStore.get("yacelltech_demo_admin")?.value;
  if (demoSession === "authenticated_admin") {
    return {
      isAdmin: true,
      userId: "00000000-0000-4000-8000-000000000001",
      email: "admin@yacelltech.com",
      mode: "demo-local",
    };
  }

  return { isAdmin: false, userId: null, email: null, mode: "demo-local" };
}
