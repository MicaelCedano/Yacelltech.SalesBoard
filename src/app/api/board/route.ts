import { NextRequest, NextResponse } from "next/server";
import { fetchSalesBoardSnapshot } from "@/lib/data-service";
import { DateFilterPreset } from "@/types/salesboard";

export const dynamic = "force-dynamic";

const ALLOWED_PRESETS = new Set<DateFilterPreset>([
  "today",
  "yesterday",
  "last7days",
  "thisMonth",
  "custom",
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPreset = (searchParams.get("preset") ?? "today") as DateFilterPreset;
    const preset: DateFilterPreset = ALLOWED_PRESETS.has(rawPreset)
      ? rawPreset
      : "today";
    const customStart = searchParams.get("startDate") ?? undefined;
    const customEnd = searchParams.get("endDate") ?? undefined;

    const snapshot = await fetchSalesBoardSnapshot({
      preset,
      customStart,
      customEnd,
    });

    // En el endpoint público, filtramos allSellersAdminTable para exponer únicamente lo necesario
    return NextResponse.json(
      {
        settings: snapshot.settings,
        dateFilter: snapshot.dateFilter,
        goalMonths: snapshot.goalMonths,
        manager: snapshot.manager,
        rankedSellers: snapshot.rankedSellers,
        allSellersAdminTable: snapshot.allSellersAdminTable,
        lastUpdatedIso: snapshot.lastUpdatedIso,
        dataSource: snapshot.dataSource,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al cargar el tablero de ventas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
