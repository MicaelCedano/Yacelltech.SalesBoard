import {
  AppSettings,
  DailyGoalRecord,
  DailySaleRecord,
  DateRangeFilter,
  ManagerSummaryStat,
  RankedSellerStat,
  RankMedal,
  SalesBoardSnapshot,
  Seller,
} from "@/types/salesboard";
import { enumerateDatesBetween } from "@/lib/date-utils";

export interface DirectDailyUpdateItem {
  seller_id: string;
  units_sold: number;
  individual_goal?: number;
  expected_version?: number;
}

export interface AuditDiffItem {
  seller_id: string;
  seller_name: string;
  previous_units: number;
  new_units: number;
  previous_goal: number;
  new_goal: number;
}

/**
 * Regla fundamental (Sección 7.1):
 * El administrador introduce directamente el TOTAL ACUMULADO del día para cada vendedor.
 * Ejemplo: Si Carlos tenía 12 equipos y el administrador escribe 15, el nuevo valor es 15 (NO 27).
 * Además verifica control de concurrencia optimista mediante `expected_version`.
 */
export function applyDirectCumulativeDailySalesUpdate(params: {
  saleDate: string;
  existingSales: DailySaleRecord[];
  sellers: Seller[];
  updates: DirectDailyUpdateItem[];
  actorId?: string | null;
  nowIso?: string;
}): {
  updatedSales: DailySaleRecord[];
  updatedSellers: Seller[];
  auditDiffs: AuditDiffItem[];
} {
  const {
    saleDate,
    existingSales,
    sellers,
    updates,
    actorId = null,
    nowIso = new Date().toISOString(),
  } = params;

  const sellerMap = new Map<string, Seller>(sellers.map((s) => [s.id, s]));
  const salesKey = (sellerId: string, date: string) => `${sellerId}__${date}`;

  // Clonar mapa de ventas existentes deduplicado por (seller_id, sale_date)
  const salesMap = new Map<string, DailySaleRecord>();
  for (const record of existingSales) {
    salesMap.set(salesKey(record.seller_id, record.sale_date), { ...record });
  }

  const auditDiffs: AuditDiffItem[] = [];
  const updatedSellersMap = new Map<string, Seller>(sellers.map((s) => [s.id, { ...s }]));

  for (const item of updates) {
    if (!Number.isInteger(item.units_sold) || item.units_sold < 0) {
      throw new Error(`La cantidad de puntos para el vendedor ${item.seller_id} debe ser un entero no negativo.`);
    }
    if (item.individual_goal !== undefined && (!Number.isInteger(item.individual_goal) || item.individual_goal < 0)) {
      throw new Error(`La meta individual para el vendedor ${item.seller_id} debe ser un entero no negativo.`);
    }

    const seller = updatedSellersMap.get(item.seller_id) ?? sellerMap.get(item.seller_id);
    if (!seller) {
      throw new Error(`Vendedor no encontrado: ${item.seller_id}`);
    }

    const key = salesKey(item.seller_id, saleDate);
    const existing = salesMap.get(key);

    // Prevención de sobrescritura concurrente si se envía expected_version
    if (
      typeof item.expected_version === "number" &&
      (existing?.version ?? 0) !== item.expected_version
    ) {
      throw new Error(
        `CONFLICT: Las estadísticas de ${seller.full_name} fueron modificadas por otro administrador (versión actual ${existing?.version ?? 0}, esperada ${item.expected_version}). Recarga antes de guardar.`
      );
    }

    const previousUnits = existing ? existing.units_sold : 0;
    const previousGoal = existing ? existing.individual_goal_snapshot : seller.individual_goal;

    // REEMPLAZO DIRECTO DEL TOTAL ACUMULADO DEL DÍA (12 -> 15 resulta en 15, nunca 27)
    const newUnits = item.units_sold;
    const newGoal = item.individual_goal ?? existing?.individual_goal_snapshot ?? 0;

    if (previousUnits !== newUnits || previousGoal !== newGoal || !existing) {
      auditDiffs.push({
        seller_id: seller.id,
        seller_name: seller.full_name,
        previous_units: previousUnits,
        new_units: newUnits,
        previous_goal: previousGoal,
        new_goal: newGoal,
      });
    }

    const nextRecord: DailySaleRecord = existing
      ? {
          ...existing,
          units_sold: newUnits,
          individual_goal_snapshot: newGoal,
          version: existing.version + 1,
          updated_by: actorId,
          updated_at: nowIso,
        }
      : {
          id: `sale-${item.seller_id}-${saleDate}`,
          seller_id: item.seller_id,
          sale_date: saleDate,
          units_sold: newUnits,
          individual_goal_snapshot: newGoal,
          version: 1,
          updated_by: actorId,
          created_at: nowIso,
          updated_at: nowIso,
        };

    salesMap.set(key, nextRecord);

    // Actualizar también la meta predeterminada del vendedor si cambió
    if (item.individual_goal !== undefined && seller.individual_goal !== newGoal) {
      updatedSellersMap.set(seller.id, {
        ...seller,
        individual_goal: newGoal,
        updated_at: nowIso,
      });
    }
  }

  return {
    updatedSales: Array.from(salesMap.values()),
    updatedSellers: Array.from(updatedSellersMap.values()),
    auditDiffs,
  };
}

/**
 * Calcula las estadísticas completas del tablero (Manager General + Ranking + Barras con escala común)
 * para cualquier fecha o rango de fechas seleccionado.
 */
export function buildSalesBoardSnapshot(params: {
  settings: AppSettings;
  sellers: Seller[];
  dailySales: DailySaleRecord[];
  dailyGoals: DailyGoalRecord[];
  dateFilter: DateRangeFilter;
  dataSource: "supabase" | "demo-local";
}): SalesBoardSnapshot {
  const { settings, sellers, dailySales, dateFilter, dataSource } = params;

  const datesInRange = enumerateDatesBetween(dateFilter.startDate, dateFilter.endDate);
  const numDays = Math.max(1, datesInRange.length);
  const monthCount = datesInRange.length > 1
    ? new Set(datesInRange.map((date) => date.slice(0, 7))).size
    : 1;
  // Todos los períodos se comparan con la meta mensual, sin prorrateo diario.
  const monthlyGoalForRange = Math.max(0, settings.default_monthly_seller_goal ?? 400);
  const dateSet = new Set(datesInRange);

  // 1. Deduplicar registros diarios por (seller_id, sale_date) quedándose con el más reciente
  const deduplicatedSalesMap = new Map<string, DailySaleRecord>();
  for (const sale of dailySales) {
    if (!dateSet.has(sale.sale_date)) continue;
    const key = `${sale.seller_id}__${sale.sale_date}`;
    const current = deduplicatedSalesMap.get(key);
    if (!current || sale.updated_at >= current.updated_at) {
      deduplicatedSalesMap.set(key, sale);
    }
  }

  // 2. Agrupar ventas por vendedor dentro del rango de fechas
  const salesBySeller = new Map<
    string,
    {
      totalUnits: number;
      latestUpdatedAt: string | null;
      latestVersion: number;
      singleDayGoalSnapshot: number | null;
    }
  >();

  let latestGlobalUpdate = settings.updated_at;

  for (const sale of deduplicatedSalesMap.values()) {
    const safeUnits = Math.max(0, Math.floor(sale.units_sold));
    const prev = salesBySeller.get(sale.seller_id) ?? {
      totalUnits: 0,
      latestUpdatedAt: null,
      latestVersion: 0,
      singleDayGoalSnapshot: null,
    };

    const nextUpdatedAt =
      !prev.latestUpdatedAt || sale.updated_at > prev.latestUpdatedAt
        ? sale.updated_at
        : prev.latestUpdatedAt;

    if (sale.updated_at > latestGlobalUpdate) {
      latestGlobalUpdate = sale.updated_at;
    }

    salesBySeller.set(sale.seller_id, {
      totalUnits: prev.totalUnits + safeUnits,
      latestUpdatedAt: nextUpdatedAt,
      latestVersion: Math.max(prev.latestVersion, sale.version),
      singleDayGoalSnapshot:
        numDays === 1 ? sale.individual_goal_snapshot : prev.singleDayGoalSnapshot,
    });
  }

  // 3. Calcular el total del Manager General:
  // Suma las ventas de TODOS los vendedores de la tienda en la fecha/rango seleccionado,
  // incluyendo los que no aparezcan en pantalla (show_on_board = false), sin duplicar ni inventar ventas.
  const validSellerIds = new Set(sellers.map((s) => s.id));
  let managerTotalUnits = 0;
  for (const [sellerId, agg] of salesBySeller.entries()) {
    if (validSellerIds.has(sellerId)) {
      managerTotalUnits += agg.totalUnits;
    }
  }

  const activeSellers = sellers.filter((s) => s.is_active);
  const visibleBoardSellers = activeSellers.filter((s) => s.show_on_board);
  const monthlyManagerGoal = Math.max(0, settings.default_monthly_manager_goal ?? 1000);
  const totalGeneralGoal = monthlyManagerGoal * monthCount;

  const managerCompletionPercent =
    totalGeneralGoal > 0 ? Math.round((managerTotalUnits * 100) / totalGeneralGoal) : 0;
  const managerProgressBarWidthPercent =
    totalGeneralGoal > 0
      ? Math.min(100, Math.max(0, Number(((managerTotalUnits / totalGeneralGoal) * 100).toFixed(2))))
      : 0;
  const managerRemainingUnits = Math.max(0, totalGeneralGoal - managerTotalUnits);

  const managerSummary: ManagerSummaryStat = {
    managerName: settings.manager_name,
    managerLabel: settings.manager_label || "MANAGER GENERAL",
    managerAvatarUrl: settings.manager_avatar_url,
    totalUnitsSold: managerTotalUnits,
    generalGoal: totalGeneralGoal,
    completionPercent: managerCompletionPercent,
    progressBarWidthPercent: managerProgressBarWidthPercent,
    remainingUnits: managerRemainingUnits,
    isGoalMet: totalGeneralGoal > 0 && managerTotalUnits >= totalGeneralGoal,
    activeSellersCount: activeSellers.length,
    visibleSellersCount: visibleBoardSellers.length,
  };

  // 4. Construir y clasificar los vendedores visibles en el tablero público
  const rankedSellers = computeRankedSellerStats(
    visibleBoardSellers,
    salesBySeller,
    numDays,
    monthlyGoalForRange,
    monthCount
  );

  // 5. Construir lista completa para el panel administrativo (todos los vendedores activos Primero, luego inactivos)
  const allSellersAdminTable = computeRankedSellerStats(
    sellers,
    salesBySeller,
    numDays,
    monthlyGoalForRange,
    monthCount
  );

  return {
    settings: {
      ...settings,
      default_monthly_seller_goal: monthlyGoalForRange,
      default_monthly_manager_goal: monthlyManagerGoal,
      monthly_seller_prize_name: (settings.monthly_seller_prize_name ?? "").trim(),
      monthly_seller_prize_value: Math.max(0, Math.floor(settings.monthly_seller_prize_value ?? 0)),
      // Show the new default for existing boards while preserving custom titles.
      board_title: settings.board_title === "Ranking de ventas" ? "Ranking de puntos" : settings.board_title,
    },
    dateFilter,
    goalMonths: monthCount,
    manager: managerSummary,
    rankedSellers,
    allSellersAdminTable,
    lastUpdatedIso: latestGlobalUpdate,
    dataSource,
  };
}

/**
 * Clasifica un conjunto de vendedores según equipos vendidos, aplicando:
 * - Escala común proporcional a la mayor cantidad de equipos vendidos (nunca por % de meta).
 * - Regla consistente de empates (Competition Ranking: si dos empatan en 1er lugar con >0 equipos,
 *   ambos reciben rank = 1 y medalla 'gold' con indicador `isTied = true`, sin asignar arbitrariamente una corona exclusiva).
 */
export function computeRankedSellerStats(
  sellersList: Seller[],
  salesBySeller: Map<
    string,
    {
      totalUnits: number;
      latestUpdatedAt: string | null;
      latestVersion: number;
      singleDayGoalSnapshot: number | null;
    }
  >,
  numDays: number,
  monthlyGoal: number | null,
  monthCount: number
): RankedSellerStat[] {
  // Ordenar por unidades vendidas DESC; en caso de empate, por display_order ASC y nombre ASC
  const sorted = [...sellersList].sort((a, b) => {
    const unitsA = salesBySeller.get(a.id)?.totalUnits ?? 0;
    const unitsB = salesBySeller.get(b.id)?.totalUnits ?? 0;
    if (unitsB !== unitsA) {
      return unitsB - unitsA;
    }
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.full_name.localeCompare(b.full_name, "es");
  });

  // Escala común: máxima cantidad de equipos vendidos entre los vendedores del gráfico
  const maxUnitsSold = sorted.reduce((max, seller) => {
    const units = salesBySeller.get(seller.id)?.totalUnits ?? 0;
    return units > max ? units : max;
  }, 0);

  // Contar cuántos vendedores tienen exactamente cada cantidad (> 0) para detectar empates
  const unitsFrequency = new Map<number, number>();
  for (const seller of sorted) {
    const units = salesBySeller.get(seller.id)?.totalUnits ?? 0;
    if (units > 0) {
      unitsFrequency.set(units, (unitsFrequency.get(units) ?? 0) + 1);
    }
  }

  // Asignar Competition Rank (1, 2, 3...; si dos empatan en 1°, ambos son 1° y el siguiente es 3°)
  let previousUnits: number | null = null;
  let currentCompetitionRank = 0;

  return sorted.map((seller, index) => {
    const agg = salesBySeller.get(seller.id);
    const unitsSold = agg?.totalUnits ?? 0;
    const effectiveGoal = Math.max(0, (monthlyGoal ?? 400) * monthCount);

    const goalCompletionPercent =
      effectiveGoal > 0 ? Math.round((unitsSold * 100) / effectiveGoal) : 0;
    const isGoalCompleted = effectiveGoal > 0 && unitsSold >= effectiveGoal;
    const remainingForIndividualGoal = Math.max(0, effectiveGoal - unitsSold);

    // Altura de barra proporcional en escala común de equipos vendidos
    const barHeightPercent =
      maxUnitsSold > 0 && unitsSold > 0
        ? Number(((unitsSold / maxUnitsSold) * 100).toFixed(2))
        : 0;

    // Indicador opcional de dónde cae la meta individual dentro de la misma escala común
    const goalMarkerHeightPercent =
      maxUnitsSold > 0 && effectiveGoal > 0 && effectiveGoal <= maxUnitsSold
        ? Number(((effectiveGoal / maxUnitsSold) * 100).toFixed(2))
        : null;

    let rank: number | null = null;
    let medal: RankMedal = "none";
    const isTied = unitsSold > 0 && (unitsFrequency.get(unitsSold) ?? 0) > 1;

    if (unitsSold > 0) {
      if (previousUnits === null || unitsSold < previousUnits) {
        currentCompetitionRank = index + 1;
      }
      previousUnits = unitsSold;
      rank = currentCompetitionRank;

      if (rank === 1) {
        medal = "gold";
      } else if (rank === 2) {
        medal = "silver";
      } else if (rank === 3) {
        medal = "bronze";
      }
    }

    return {
      seller,
      unitsSold,
      effectiveGoal,
      goalCompletionPercent,
      isGoalCompleted,
      remainingForIndividualGoal,
      barHeightPercent,
      goalMarkerHeightPercent,
      rank,
      medal,
      isTied,
      lastUpdatedAt: agg?.latestUpdatedAt ?? null,
      recordVersion: agg?.latestVersion ?? 0,
    };
  });
}
