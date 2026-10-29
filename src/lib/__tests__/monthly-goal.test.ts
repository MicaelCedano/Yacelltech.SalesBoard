import { describe, expect, it } from "vitest";
import { createSeedDemoDatabase } from "@/lib/demo-store";
import { buildSalesBoardSnapshot } from "@/lib/calculations";
import { resolveDateRangeFilter } from "@/lib/date-utils";
import type { DateRangeFilter } from "@/types/salesboard";

function snapshot(filter: DateRangeFilter) {
  const db = createSeedDemoDatabase("daily_34_of_50");
  return buildSalesBoardSnapshot({
    settings: { ...db.settings, default_monthly_seller_goal: 400 },
    sellers: db.sellers.map((seller, index) => ({ ...seller, individual_goal: index === 0 ? 100 : 20 })),
    dailySales: [{ id: "monthly-points", seller_id: db.sellers[0]!.id, sale_date: filter.endDate,
      units_sold: 100, individual_goal_snapshot: 100, version: 1,
      created_at: `${filter.endDate}T12:00:00Z`, updated_at: `${filter.endDate}T12:00:00Z` }],
    dailyGoals: [], dateFilter: filter, dataSource: "demo-local",
  });
}

describe("Meta mensual compartida", () => {
  it("usa 400 para todos los vendedores, aunque sus metas diarias sean diferentes", () => {
    const board = snapshot(resolveDateRangeFilter("thisMonth", "2026-10-29"));
    expect(board.allSellersAdminTable.every((seller) => seller.effectiveGoal === 400)).toBe(true);
    expect(board.allSellersAdminTable.find((seller) => seller.unitsSold === 100)?.goalCompletionPercent).toBe(25);
  });

  it("mantiene la meta mensual el primer día del mes", () => {
    expect(snapshot(resolveDateRangeFilter("thisMonth", "2026-11-01")).allSellersAdminTable.every((seller) => seller.effectiveGoal === 400)).toBe(true);
  });

  it("mantiene la meta mensual después de reiniciar el ciclo a mitad de mes", () => {
    const filter = { ...resolveDateRangeFilter("thisMonth", "2026-10-29"), startDate: "2026-10-28" };
    expect(snapshot(filter).allSellersAdminTable.every((seller) => seller.effectiveGoal === 400)).toBe(true);
  });

  it("conserva la meta diaria al consultar un solo día, incluido el primero del mes", () => {
    const board = snapshot(resolveDateRangeFilter("today", "2026-11-01"));
    expect(board.allSellersAdminTable.find((seller) => seller.unitsSold === 100)?.effectiveGoal).toBe(100);
    expect(board.allSellersAdminTable.filter((seller) => seller.unitsSold === 0).every((seller) => seller.effectiveGoal === 20)).toBe(true);
  });

  it("acumula una meta por mes cuando el rango incluye dos meses desde el día primero", () => {
    const filter = resolveDateRangeFilter("custom", "2026-11-02", "2026-10-01", "2026-11-02");
    expect(snapshot(filter).allSellersAdminTable.every((seller) => seller.effectiveGoal === 800)).toBe(true);
  });
});
