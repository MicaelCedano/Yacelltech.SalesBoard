import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient, verifyServerAdminSession } from "@/lib/supabase/server";
import { loginCredentialsSchema } from "@/lib/validations";

export async function GET() {
  const session = await verifyServerAdminSession();
  return NextResponse.json(session, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginCredentialsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Credenciales inválidas",
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const supabase = await getSupabaseServerClient();

    // Si Supabase está configurado, autenticar contra Supabase Auth y verificar rol admin en `profiles`
    if (supabase) {
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError || !authData.user) {
        return NextResponse.json(
          {
            error:
              "Credenciales incorrectas o usuario no autorizado. El registro público está deshabilitado.",
          },
          { status: 401 }
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, role, is_active")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile || profile.role !== "admin" || !profile.is_active) {
        await supabase.auth.signOut();
        return NextResponse.json(
          {
            error:
              "Acceso denegado: Tu cuenta no posee privilegios de administrador en YacellTech SalesBoard.",
          },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        email: profile.email,
        mode: "supabase",
      });
    }

    // Modo demostración local aislado (cuando Supabase aún no está configurado en .env.local)
    const demoAdminEmail =
      process.env.DEMO_ADMIN_EMAIL?.toLowerCase() ?? "admin@yacelltech.com";
    const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD ?? "Yacell2026!";

    if (email.toLowerCase() !== demoAdminEmail || password !== demoAdminPassword) {
      return NextResponse.json(
        {
          error: `En Modo Demostración Local usa: ${demoAdminEmail} / ${demoAdminPassword}`,
        },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("yacelltech_demo_admin", "authenticated_admin", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 horas
    });

    return NextResponse.json({
      success: true,
      email: demoAdminEmail,
      mode: "demo-local",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno de autenticación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  const cookieStore = await cookies();
  cookieStore.delete("yacelltech_demo_admin");

  return NextResponse.json({ success: true });
}
