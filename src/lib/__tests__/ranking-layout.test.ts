import { describe, expect, it } from "vitest";
import { arrangeCenteredRanking } from "@/lib/ranking-layout";

describe("Líder en el centro del gráfico", () => {
  it("coloca segundo a la izquierda y tercero a la derecha con cinco vendedores", () => {
    const original = [1, 2, 3, 4, 5].map((rank) => ({ rank }));
    const result = arrangeCenteredRanking(original);
    expect(result.orderedSellers.map((seller) => seller.rank)).toEqual([4, 2, 1, 3, 5]);
    expect(result.needsTrailingSpace).toBe(false);
    expect(original.map((seller) => seller.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("mantiene el centro exacto con seis vendedores sin añadir un vendedor ficticio", () => {
    const result = arrangeCenteredRanking([1, 2, 3, 4, 5, 6].map((rank) => ({ rank })));
    expect(result.orderedSellers.map((seller) => seller.rank)).toEqual([6, 4, 2, 1, 3, 5]);
    expect(result.needsTrailingSpace).toBe(true);
    expect(result.orderedSellers).toHaveLength(6);
  });

  it("centra juntos a los vendedores que comparten el primer lugar", () => {
    const result = arrangeCenteredRanking([1, 1, 3, 4].map((rank, id) => ({ rank, id })));
    expect(result.orderedSellers.map((seller) => seller.rank)).toEqual([3, 1, 1, 4]);
    expect(result.needsTrailingSpace).toBe(false);
    expect(result.orderedSellers.filter((seller) => seller.rank === 1)).toHaveLength(2);
  });

  it("mantiene el orden existente cuando todos están en cero", () => {
    const sellers = [{ rank: null, id: "a" }, { rank: null, id: "b" }];
    expect(arrangeCenteredRanking(sellers)).toEqual({ orderedSellers: sellers, needsTrailingSpace: false });
  });

  it("admite un solo vendedor y un equipo vacío", () => {
    expect(arrangeCenteredRanking([{ rank: 1 }])).toEqual({ orderedSellers: [{ rank: 1 }], needsTrailingSpace: false });
    expect(arrangeCenteredRanking([])).toEqual({ orderedSellers: [], needsTrailingSpace: false });
  });
});
