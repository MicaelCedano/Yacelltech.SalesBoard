import { NextRequest, NextResponse } from "next/server";
import { verifyServerAdminSession } from "@/lib/supabase/server";
import { pointsReportRangeSchema } from "@/lib/validations";
import { fetchPointsReport } from "@/lib/points-report-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const params = request.nextUrl.searchParams;
    const parsed = pointsReportRangeSchema.safeParse({ startDate: params.get("startDate"), endDate: params.get("endDate") });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Rango inválido" }, { status: 400 });
    const format = params.get("format") ?? "json";
    if (!["json", "xlsx"].includes(format)) return NextResponse.json({ error: "Formato no permitido" }, { status: 400 });
    const report = await fetchPointsReport(parsed.data.startDate, parsed.data.endDate);
    if (format === "json") return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } });
    const { createPointsReportExcel } = await import("@/lib/points-report-excel");
    const buffer = await createPointsReportExcel(report);
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="YacellTech-puntos-${report.startDate}-a-${report.endDate}.xlsx"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo generar el reporte" }, { status: 500 });
  }
}
