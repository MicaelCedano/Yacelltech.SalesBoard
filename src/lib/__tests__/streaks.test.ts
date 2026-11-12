import { describe, expect, it } from "vitest";
import { calculateLeadershipStreaks } from "@/lib/calculations";

describe("rachas de liderazgo verificadas", () => {
  it("cuenta cierres consecutivos incluyendo empates y cambios de mes", () => {
    const rows = [
      { closure_date: "2026-10-31", leader_ids: ["pamela"] },
      { closure_date: "2026-11-01", leader_ids: ["pamela", "cristy"] },
      { closure_date: "2026-11-02", leader_ids: ["pamela", "cristy"] },
    ];
    expect(calculateLeadershipStreaks(rows, "2026-11-03").get("pamela")).toBe(3);
    expect(calculateLeadershipStreaks(rows, "2026-11-03").get("cristy")).toBe(2);
  });
  it("rompe la racha con un cierre faltante o sin líder", () => {
    const rows = [{ closure_date: "2026-11-01", leader_ids: ["a"] }, { closure_date: "2026-11-03", leader_ids: ["a"] }];
    expect(calculateLeadershipStreaks(rows, "2026-11-04").get("a")).toBe(1);
    expect(calculateLeadershipStreaks(rows, "2026-11-05").size).toBe(0);
    expect(calculateLeadershipStreaks([...rows, { closure_date: "2026-11-04", leader_ids: [] }], "2026-11-05").size).toBe(0);
  });
  it("comienza la racha del nuevo líder al cambiar el primer lugar", () => {
    expect(calculateLeadershipStreaks([{ closure_date: "2026-11-01", leader_ids: ["a"] }, { closure_date: "2026-11-02", leader_ids: ["b"] }], "2026-11-03").get("b")).toBe(1);
  });
});
