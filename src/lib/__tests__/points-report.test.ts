import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createSeedDemoDatabase } from "@/lib/demo-store";
import { buildPointsReport } from "@/lib/points-report";
import { createPointsReportExcel } from "@/lib/points-report-excel";
import { pointsReportRangeSchema } from "@/lib/validations";
import type { AuditLogEntry, DailySaleRecord } from "@/types/salesboard";

function fixture() {
  const db = createSeedDemoDatabase("daily_34_of_50");
  const sellers = db.sellers.slice(0, 2);
  sellers[0] = { ...sellers[0]!, full_name: "=1+1", is_active: false, show_on_board: false };
  const sale = (seller: number, date: string, units: number): DailySaleRecord => ({
    id: crypto.randomUUID(), seller_id: sellers[seller]!.id, sale_date: date, units_sold: units,
    individual_goal_snapshot: 20, version: 1, created_at: `${date}T12:00:00Z`, updated_at: `${date}T12:00:00Z`,
  });
  const log: AuditLogEntry = {
    id: crypto.randomUUID(), actor_id: null, actor_email: "admin@example.com", action_type: "BATCH_DAILY_SALES_UPDATE", entity_type: "daily_sales", entity_id: "2026-10-27", sale_date: "2026-10-27", created_at: "2026-10-28T01:30:00Z",
    previous_values: { sellers: [{ seller_id: sellers[0]!.id, units_sold: 20 }] },
    new_values: { request: { mode: "set" }, sellers: [{ seller_id: sellers[0]!.id, units_sold: 17 }] },
  };
  return { startDate: "2026-10-27", endDate: "2026-10-29", storeName: "YacellTech", sellers,
    sales: [sale(0, "2026-10-26", 900), sale(0, "2026-10-27", 17), sale(1, "2026-10-28", 0), sale(1, "2026-10-29", 7), sale(1, "2026-10-30", 800)], logs: [log] };
}

describe("Reportes de puntos y Excel", () => {
  it("incluye los extremos, inactivos y ocultos, sin sumar saldos acumulados ni fechas ajenas", () => {
    const input = fixture(); const report = buildPointsReport(input);
    expect(report.total).toBe(24);
    expect(report.days.map((day) => day.total)).toEqual([17, 0, 7]);
    expect(report.days[0]!.points[input.sellers[1]!.id]).toBeNull();
    expect(report.days[1]!.points[input.sellers[1]!.id]).toBe(0);
    expect(report.sellers.map((seller) => seller.total)).toEqual([17, 7]);
    expect(report.movements[0]).toMatchObject({ date: "2026-10-27", points: -3, previous: 20, total: 17, type: "Corrección" });
  });
  it("rechaza días inexistentes, rangos invertidos y más de 366 días", () => {
    for (const [startDate, endDate] of [["2026-02-30", "2026-03-01"], ["2026-10-29", "2026-10-27"], ["2025-01-01", "2026-01-02"]]) expect(pointsReportRangeSchema.safeParse({ startDate, endDate }).success).toBe(false);
    expect(pointsReportRangeSchema.safeParse({ startDate: "2024-02-29", endDate: "2024-02-29" }).success).toBe(true);
  });
  it("no inventa aplicaciones para registros sin auditoría y rechaza duplicados diarios", () => {
    const input = fixture();
    expect(buildPointsReport({ ...input, logs: [] }).movements).toEqual([]);
    expect(() => buildPointsReport({ ...input, sales: [...input.sales, input.sales[1]!] })).toThrow("duplicados");
  });
  it("exporta un XLSX real con fechas y puntos numéricos, totales conciliados y nombres como texto", async () => {
    const report = buildPointsReport(fixture());
    const output = await createPointsReportExcel(report);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(output);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["Resumen", "Puntos por día", "Detalle diario", "Movimientos"]);
    const summary = book.getWorksheet("Resumen")!;
    expect(summary.getCell("A5").value).toBe("=1+1");
    expect(summary.getCell("A5").type).toBe(ExcelJS.ValueType.String);
    expect(summary.getCell("C7").value).toMatchObject({ result: 24 });
    const daily = book.getWorksheet("Puntos por día")!;
    expect(daily.getCell("A5").value).toEqual(new Date("2026-10-27T00:00:00Z"));
    expect(daily.getCell("B5").value).toBe(17);
    expect(daily.getCell("C5").value).toBeNull();
    expect(daily.getCell("C6").value).toBe(0);
    expect(daily.getCell("D8").value).toMatchObject({ result: 24 });
    expect(book.getWorksheet("Movimientos")!.getCell("D5").value).toBe(-3);
    expect(daily.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 4 });
  });
});
