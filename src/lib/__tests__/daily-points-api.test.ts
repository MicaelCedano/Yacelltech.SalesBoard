import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/sales/route";
import { GET } from "@/app/api/admin/reports/route";
import { verifyServerAdminSession, getSupabaseServerClient } from "@/lib/supabase/server";
import { readDemoDatabase, writeDemoDatabase, createSeedDemoDatabase } from "@/lib/demo-store";
import { saveBatchDailySales, fetchSalesBoardSnapshot, updateManagerSettingsRecord } from "@/lib/data-service";
import { batchSaveDailySalesSchema, updateManagerSettingsSchema } from "@/lib/validations";
import { addDaysToDateString, getFirstDayOfMonth, getSantoDomingoToday } from "@/lib/date-utils";

vi.mock("@/lib/supabase/server", () => ({ verifyServerAdminSession: vi.fn(), getSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/demo-store", async (original) => ({ ...await original<typeof import("@/lib/demo-store")>(), readDemoDatabase: vi.fn(), writeDemoDatabase: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSupabaseServerClient).mockResolvedValue(null);
  vi.mocked(verifyServerAdminSession).mockResolvedValue({ isAdmin: true, userId: "admin", email: "admin@example.com", mode: "demo-local" });
  vi.mocked(readDemoDatabase).mockReturnValue(createSeedDemoDatabase("daily_34_of_50"));
});

describe("Permisos, validación y sumas locales", () => {
  it("guarda puntos sin metas diarias y mantiene los valores históricos", async () => {
    const db = readDemoDatabase(); const seller = db.sellers[0]!;
    const goals = structuredClone(db.dailyGoals); const sellers = structuredClone(db.sellers);
    const response = await POST(new NextRequest("http://localhost/api/admin/sales", { method: "POST", body: JSON.stringify({
      request_id: crypto.randomUUID(), mode: "add", sale_date: getSantoDomingoToday(),
      entries: [{ seller_id: seller.id, units_sold: 3 }],
    }) }));
    expect(response.status).toBe(200);
    expect(db.dailyGoals).toEqual(goals);
    expect(db.sellers).toEqual(sellers);
    expect((await response.json()).snapshot.manager.generalGoal).toBe(db.sellers.filter((item) => item.is_active).length * 400);
  });
  it("configura una sola meta mensual y deriva la del equipo sin alterar metas diarias antiguas", async () => {
    const db = readDemoDatabase(); const goals = structuredClone(db.dailyGoals);
    const oldGoal = db.settings.default_general_goal;
    await updateManagerSettingsRecord(updateManagerSettingsSchema.parse({ ...db.settings,
      default_general_goal: 9999, default_monthly_seller_goal: 500,
    }), { userId: "admin", email: "admin@example.com" });
    expect(db.settings.default_monthly_seller_goal).toBe(500);
    expect(db.settings.default_general_goal).toBe(oldGoal);
    expect(db.dailyGoals).toEqual(goals);
    const board = await fetchSalesBoardSnapshot({ preset: "thisMonth" });
    expect(board.manager.generalGoal).toBe(db.sellers.filter((item) => item.is_active).length * 500);
    expect(board.allSellersAdminTable.every((item) => item.effectiveGoal === 500)).toBe(true);
  });
  it("no permite guardar ni exportar sin administrador", async () => {
    vi.mocked(verifyServerAdminSession).mockResolvedValue({ isAdmin: false, userId: null, email: null, mode: "demo-local" });
    expect((await POST(new NextRequest("http://localhost/api/admin/sales", { method: "POST", body: "{}" }))).status).toBe(403);
    expect((await GET(new NextRequest("http://localhost/api/admin/reports?startDate=2026-10-01&endDate=2026-10-27&format=xlsx"))).status).toBe(403);
    expect(readDemoDatabase).not.toHaveBeenCalled();
  });
  it("rechaza rangos inválidos y formatos que no están permitidos", async () => {
    expect((await GET(new NextRequest("http://localhost/api/admin/reports?startDate=2026-10-30&endDate=2026-10-01"))).status).toBe(400);
    expect((await GET(new NextRequest("http://localhost/api/admin/reports?startDate=2026-10-01&endDate=2026-10-27&format=html"))).status).toBe(400);
    expect(readDemoDatabase).not.toHaveBeenCalled();
  });
  it("suma y reintenta sin duplicar en demo, y registra el incremento exacto", async () => {
    const db = readDemoDatabase(); const seller = db.sellers[0]!;
    const date = getSantoDomingoToday();
    const before = db.dailySales.find((sale) => sale.sale_date === date && sale.seller_id === seller.id)!.units_sold;
    const input = batchSaveDailySalesSchema.parse({ request_id: crypto.randomUUID(), mode: "add", sale_date: date, general_goal: 50,
      entries: [{ seller_id: seller.id, units_sold: 7, individual_goal: seller.individual_goal, expected_version: 0 }] });
    const actor = { userId: "admin", email: "admin@example.com" };
    await saveBatchDailySales(input, actor); await saveBatchDailySales(input, actor);
    expect(db.dailySales.find((sale) => sale.sale_date === date && sale.seller_id === seller.id)!.units_sold).toBe(before + 7);
    expect(db.auditLogs.filter((log) => log.id === input.request_id)).toHaveLength(1);
    expect(writeDemoDatabase).toHaveBeenCalledTimes(1);
    const response = await GET(new NextRequest(`http://localhost/api/admin/reports?startDate=${date}&endDate=${date}`));
    expect(response.status).toBe(200);
    expect((await response.json()).movements).toContainEqual(expect.objectContaining({ sellerId: seller.id, points: 7, type: "Suma" }));
  });
  it("devuelve un archivo XLSX descargable desde la API", async () => {
    const date = getSantoDomingoToday();
    const response = await GET(new NextRequest(`http://localhost/api/admin/reports?startDate=${date}&endDate=${date}&format=xlsx`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(response.headers.get("Content-Disposition")).toContain(`YacellTech-puntos-${date}-a-${date}.xlsx`);
    expect(Array.from(new Uint8Array(await response.arrayBuffer()).slice(0, 2))).toEqual([80, 75]);
  }, 15000);
  it("cierra el mes reiniciando la pantalla a 0 para empezar a sumar pero conservando intacto el historial diario", async () => {
    const today = getSantoDomingoToday();
    const yesterday = addDaysToDateString(today, -1);
    const firstOfMonth = getFirstDayOfMonth(today);
    const beforeMonth = await fetchSalesBoardSnapshot({ preset: "thisMonth" });
    expect(beforeMonth.manager.totalUnitsSold).toBeGreaterThan(0);

    const closeRes = await POST(
      new NextRequest("http://localhost/api/admin/sales", {
        method: "POST",
        body: JSON.stringify({ request_id: crypto.randomUUID(), mode: "close_month", sale_date: today }),
      })
    );
    expect(closeRes.status).toBe(200);
    const closeData = await closeRes.json();
    expect(closeData.closedTotal).toBe(beforeMonth.manager.totalUnitsSold);
    expect(closeData.snapshot.manager.totalUnitsSold).toBe(0);
    expect(closeData.monthSnapshot.manager.totalUnitsSold).toBe(0);

    // El historial del mes y del día anterior sigue intacto sin necesidad de Excel
    const reportRes = await GET(
      new NextRequest(`http://localhost/api/admin/reports?startDate=${firstOfMonth}&endDate=${today}`)
    );
    expect(reportRes.status).toBe(200);
    const report = await reportRes.json();
    expect(report.total).toBe(beforeMonth.manager.totalUnitsSold);
    expect(report.closures).toHaveLength(1);
    expect(report.closures[0].totalPoints).toBe(beforeMonth.manager.totalUnitsSold);

    // El día anterior conserva sus puntos exactos
    const yesterdaySnap = await fetchSalesBoardSnapshot({ preset: "yesterday" });
    expect(yesterdaySnap.manager.totalUnitsSold).toBe(59);
    const yesterdayRow = report.days.find((d: { date: string }) => d.date === yesterday);
    expect(yesterdayRow?.total).toBe(59);
  });
});
