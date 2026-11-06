import { describe, expect, it } from "vitest";
import { calculateStreaks } from "@/lib/calculations";

describe("rachas de puntos", () => {
  it("cuenta días consecutivos entre meses y conserva la racha de ayer", () => {
    const sales = ["2026-10-30", "2026-10-31", "2026-11-01"].map(sale_date => ({ seller_id: "a", sale_date, units_sold: 1 }));
    expect(calculateStreaks(sales, "2026-11-01").get("a")).toBe(3);
    expect(calculateStreaks(sales, "2026-11-02").get("a")).toBe(3);
    expect(calculateStreaks(sales, "2026-11-03").get("a")).toBe(0);
  });
  it("un día corregido a cero rompe la racha y no cuenta fechas futuras", () => {
    const sales = [
      { seller_id: "a", sale_date: "2026-11-01", units_sold: 2 },
      { seller_id: "a", sale_date: "2026-11-02", units_sold: 0 },
      { seller_id: "a", sale_date: "2026-11-03", units_sold: 1 },
      { seller_id: "a", sale_date: "2026-11-04", units_sold: 1 },
    ];
    expect(calculateStreaks(sales, "2026-11-03").get("a")).toBe(1);
  });
});
