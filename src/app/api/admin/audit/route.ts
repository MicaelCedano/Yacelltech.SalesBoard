import { NextResponse } from "next/server";
import { fetchAuditLogs } from "@/lib/data-service";
import { verifyServerAdminSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para consultar el historial de auditoría." },
        { status: 403 }
      );
    }

    const logs = await fetchAuditLogs(50);
    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al consultar auditoría";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
