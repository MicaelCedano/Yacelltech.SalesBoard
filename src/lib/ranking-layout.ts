/** Disposición de podio: 4.º, 2.º, 1.º, 3.º, 5.º. No modifica el ranking. */
export function arrangeCenteredRanking<T extends { rank: number | null }>(sellers: readonly T[]): {
  orderedSellers: T[];
  needsTrailingSpace: boolean;
} {
  const leaders = sellers.filter((seller) => seller.rank === 1);
  if (leaders.length === 0) {
    return { orderedSellers: [...sellers], needsTrailingSpace: false };
  }

  const remaining = sellers.filter((seller) => seller.rank !== 1);
  const left: T[] = [];
  const right: T[] = [];
  remaining.forEach((seller, index) => (index % 2 === 0 ? left : right).push(seller));

  return {
    orderedSellers: [...left.reverse(), ...leaders, ...right],
    // Una plaza visual vacía equilibra los lados cuando hay un número impar
    // de vendedores fuera del centro, sin inventar un vendedor ni una venta.
    needsTrailingSpace: left.length > right.length,
  };
}
