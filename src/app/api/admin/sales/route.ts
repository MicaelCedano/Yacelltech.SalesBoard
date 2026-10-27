import { NextRequest, NextResponse } from "next/server";
import { saveBatchDailySales } from "@/lib/data-service";
import { verifyServerAdminSession } from "@/lib/supabase/server";
import { batchSaveDailySalesSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere sesión administrativa verificada." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = batchSaveDailySalesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos de estadísticas inválidos",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const result = await saveBatchDailySales(parsed.data, {
      userId: session.userId,
      email: session.email ?? "admin@yacelltech.com",
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al guardar estadísticas";
    const status = message.startsWith("CONFLICT:") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
