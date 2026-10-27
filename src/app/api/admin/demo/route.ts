import { NextRequest, NextResponse } from "next/server";
import { initializeExplicitDemoData } from "@/lib/data-service";
import { verifyServerAdminSession } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para inicializar datos de demostración." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const preset =
      body?.preset === "high_volume_350" ? "high_volume_350" : "daily_34_of_50";

    const snapshot = await initializeExplicitDemoData(preset, {
      userId: session.userId,
      email: session.email ?? "admin@yacelltech.com",
    });

    return NextResponse.json({ snapshot }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al inicializar datos de demostración";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
