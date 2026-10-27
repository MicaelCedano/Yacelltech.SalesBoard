import { NextRequest, NextResponse } from "next/server";
import { updateManagerSettingsRecord } from "@/lib/data-service";
import { verifyServerAdminSession } from "@/lib/supabase/server";
import { updateManagerSettingsSchema } from "@/lib/validations";

export async function PATCH(request: NextRequest) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol de administrador." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateManagerSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos de configuración inválidos" },
        { status: 400 }
      );
    }

    const settings = await updateManagerSettingsRecord(parsed.data, {
      userId: session.userId,
      email: session.email ?? "admin@yacelltech.com",
    });

    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al actualizar configuración";
    const status = message.startsWith("CONFLICT:") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
