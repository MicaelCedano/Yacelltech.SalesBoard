import { NextRequest, NextResponse } from "next/server";
import { closeCurrentMonthAndResetBoard, purgeTestHistoryBeforeDate, saveBatchDailySales } from "@/lib/data-service";
import { verifyServerAdminSession } from "@/lib/supabase/server";
import { batchSaveDailySalesSchema, closeMonthSalesSchema } from "@/lib/validations";

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

    if (body && typeof body === "object" && (body as { mode?: unknown }).mode === "purge_test_history") {
      const keepFrom = typeof (body as { keep_from?: unknown }).keep_from === "string"
        ? (body as { keep_from: string }).keep_from
        : "2026-10-30";
      const purgeResult = await purgeTestHistoryBeforeDate(keepFrom, {
        userId: session.userId,
        email: session.email ?? "admin@yacelltech.com",
      });
      return NextResponse.json(purgeResult, { status: 200 });
    }

    if (body && typeof body === "object" && (body as { mode?: unknown }).mode === "close_month") {
      const parsedClose = closeMonthSalesSchema.safeParse(body);
      if (!parsedClose.success) {
        return NextResponse.json(
          {
            error: parsedClose.error.issues[0]?.message ?? "Datos de cierre de mes inválidos",
            issues: parsedClose.error.issues,
          },
          { status: 400 }
        );
      }

      const closeResult = await closeCurrentMonthAndResetBoard(parsedClose.data, {
        userId: session.userId,
        email: session.email ?? "admin@yacelltech.com",
      });

      return NextResponse.json(closeResult, { status: 200 });
    }

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
