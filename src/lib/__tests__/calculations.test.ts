import { describe, expect, it } from "vitest";
import {
  applyDirectCumulativeDailySalesUpdate,
  buildSalesBoardSnapshot,
} from "@/lib/calculations";
import {
  addDaysToDateString,
  enumerateDatesBetween,
  resolveDateRangeFilter,
} from "@/lib/date-utils";
import {
  AppSettings,
  DailyGoalRecord,
  DailySaleRecord,
  Seller,
} from "@/types/salesboard";

const mockSettings: AppSettings = {
  id: 1,
  store_name: "YACELLTECH",
  board_title: "Ranking de ventas",
  manager_name: "Roberto Méndez",
  manager_label: "MANAGER GENERAL",
  manager_avatar_url: null,
  default_general_goal: 50,
  timezone: "America/Santo_Domingo",
  is_demo_environment: true,
  version: 1,
  updated_at: "2026-10-27T12:00:00.000Z",
};

const mockSellers: Seller[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    full_name: "Carlos",
    avatar_url: null,
    bar_color: "#10B981",
    individual_goal: 15,
    is_active: true,
    show_on_board: true,
    display_order: 1,
    is_demo: true,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    full_name: "Ana",
    avatar_url: null,
    bar_color: "#EC4899",
    individual_goal: 15,
    is_active: true,
    show_on_board: true,
    display_order: 2,
    is_demo: true,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    full_name: "Luis",
    avatar_url: null,
    bar_color: "#38BDF8",
    individual_goal: 15,
    is_active: true,
    show_on_board: true,
    display_order: 3,
    is_demo: true,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    full_name: "María",
    avatar_url: null,
    bar_color: "#F97316",
    individual_goal: 15,
    is_active: true,
    show_on_board: true,
    display_order: 4,
    is_demo: true,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    full_name: "José",
    avatar_url: null,
    bar_color: "#A855F7",
    individual_goal: 15,
    is_active: true,
    show_on_board: true,
    display_order: 5,
    is_demo: true,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  },
];

describe("YacellTech SalesBoard - Cálculos y Reglas de Negocio", () => {
  it("1. Regla de actualización directa acumulada (Sección 7.1): cambiar 12 a 15 registra 15, NO 27", () => {
    const initialSales: DailySaleRecord[] = [
      {
        id: "sale-carlos",
        seller_id: mockSellers[0]!.id,
        sale_date: "2026-10-27",
        units_sold: 12,
        individual_goal_snapshot: 15,
        version: 1,
        created_at: "2026-10-27T10:00:00.000Z",
        updated_at: "2026-10-27T10:00:00.000Z",
      },
    ];

    const result = applyDirectCumulativeDailySalesUpdate({
      saleDate: "2026-10-27",
      existingSales: initialSales,
      sellers: mockSellers,
      updates: [
        {
          seller_id: mockSellers[0]!.id,
          units_sold: 15, // El admin escribe 15
          individual_goal: 15,
          expected_version: 1,
        },
      ],
    });

    const carlosRecord = result.updatedSales.find(
      (r) => r.seller_id === mockSellers[0]!.id && r.sale_date === "2026-10-27"
    );

    expect(carlosRecord).toBeDefined();
    expect(carlosRecord?.units_sold).toBe(15);
    expect(carlosRecord?.units_sold).not.toBe(27);
    expect(carlosRecord?.version).toBe(2);
    expect(result.auditDiffs).toHaveLength(1);
    expect(result.auditDiffs[0]).toMatchObject({
      seller_name: "Carlos",
      previous_units: 12,
      new_units: 15,
    });
  });

  it("2. Cálculo del Manager General (Sección 4): suma exacta de todos los vendedores, incluyendo ocultos en tablero", () => {
    const sellersWithHidden: Seller[] = [
      ...mockSellers,
      {
        id: "66666666-6666-4666-8666-666666666666",
        full_name: "Pedro (No visible en TV)",
        avatar_url: null,
        bar_color: "#14B8A6",
        individual_goal: 10,
        is_active: true,
        show_on_board: false, // Oculto del gráfico público pero sus ventas cuentan para la tienda
        display_order: 6,
        is_demo: true,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      },
    ];

    // Total = 12 + 9 + 8 + 5 = 34 (Ejemplo exacto de la Sección 4: 34 de 50 = 68%, faltan 16)
    const salesToday: DailySaleRecord[] = [
      {
        id: "s1",
        seller_id: sellersWithHidden[0]!.id, // Carlos: 12
        sale_date: "2026-10-27",
        units_sold: 12,
        individual_goal_snapshot: 15,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
      {
        id: "s2",
        seller_id: sellersWithHidden[1]!.id, // Ana: 9
        sale_date: "2026-10-27",
        units_sold: 9,
        individual_goal_snapshot: 15,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
      {
        id: "s3",
        seller_id: sellersWithHidden[2]!.id, // Luis: 8
        sale_date: "2026-10-27",
        units_sold: 8,
        individual_goal_snapshot: 15,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
      {
        id: "s4",
        seller_id: sellersWithHidden[5]!.id, // Pedro (oculto en TV): 5
        sale_date: "2026-10-27",
        units_sold: 5,
        individual_goal_snapshot: 10,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
    ];

    const filter = resolveDateRangeFilter("today", "2026-10-27");
    const snapshot = buildSalesBoardSnapshot({
      settings: mockSettings,
      sellers: sellersWithHidden,
      dailySales: salesToday,
      dailyGoals: [],
      dateFilter: filter,
      dataSource: "demo-local",
    });

    expect(snapshot.manager.totalUnitsSold).toBe(34);
    expect(snapshot.manager.generalGoal).toBe(50);
    expect(snapshot.manager.completionPercent).toBe(68);
    expect(snapshot.manager.remainingUnits).toBe(16);
    // Pedro no aparece en las barras públicas, pero sí en el total del Manager
    expect(snapshot.rankedSellers).toHaveLength(5);
  });

  it("3. Escala común y ranking proporcional (Sección 5): Carlos 210, Ana 60, Luis 350, María 50, José 250", () => {
    const sales: DailySaleRecord[] = [
      {
        id: "c",
        seller_id: mockSellers[0]!.id, // Carlos: 210
        sale_date: "2026-10-27",
        units_sold: 210,
        individual_goal_snapshot: 300,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
      {
        id: "a",
        seller_id: mockSellers[1]!.id, // Ana: 60
        sale_date: "2026-10-27",
        units_sold: 60,
        individual_goal_snapshot: 60, // Aunque Ana tenga 100% de su meta individual, su barra NO debe ser más alta que Luis
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
      {
        id: "l",
        seller_id: mockSellers[2]!.id, // Luis: 350
        sale_date: "2026-10-27",
        units_sold: 350,
        individual_goal_snapshot: 400,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
      {
        id: "m",
        seller_id: mockSellers[3]!.id, // María: 50
        sale_date: "2026-10-27",
        units_sold: 50,
        individual_goal_snapshot: 100,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
      {
        id: "j",
        seller_id: mockSellers[4]!.id, // José: 250
        sale_date: "2026-10-27",
        units_sold: 250,
        individual_goal_snapshot: 300,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
    ];

    const filter = resolveDateRangeFilter("today", "2026-10-27");
    const snapshot = buildSalesBoardSnapshot({
      settings: mockSettings,
      sellers: mockSellers,
      dailySales: sales,
      dailyGoals: [],
      dateFilter: filter,
      dataSource: "demo-local",
    });

    const [first, second, third, fourth, fifth] = snapshot.rankedSellers;
    expect(first?.seller.full_name).toBe("Luis");
    expect(first?.medal).toBe("gold");
    expect(first?.barHeightPercent).toBe(100);

    expect(second?.seller.full_name).toBe("José");
    expect(second?.medal).toBe("silver");
    expect(second?.barHeightPercent).toBeCloseTo((250 / 350) * 100, 1);

    expect(third?.seller.full_name).toBe("Carlos");
    expect(third?.medal).toBe("bronze");
    expect(third?.barHeightPercent).toBeCloseTo((210 / 350) * 100, 1);

    expect(fourth?.seller.full_name).toBe("Ana");
    expect(fourth?.barHeightPercent).toBeCloseTo((60 / 350) * 100, 1);

    expect(fifth?.seller.full_name).toBe("María");
    expect(fifth?.barHeightPercent).toBeCloseTo((50 / 350) * 100, 1);
  });

  it("4. Manejo de empates en primer lugar (Sección 6): no asigna arbitrariamente una corona exclusiva", () => {
    const tieSales: DailySaleRecord[] = [
      {
        id: "l",
        seller_id: mockSellers[2]!.id, // Luis: 250
        sale_date: "2026-10-27",
        units_sold: 250,
        individual_goal_snapshot: 15,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
      {
        id: "j",
        seller_id: mockSellers[4]!.id, // José: 250
        sale_date: "2026-10-27",
        units_sold: 250,
        individual_goal_snapshot: 15,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
      {
        id: "c",
        seller_id: mockSellers[0]!.id, // Carlos: 180
        sale_date: "2026-10-27",
        units_sold: 180,
        individual_goal_snapshot: 15,
        version: 1,
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
    ];

    const snapshot = buildSalesBoardSnapshot({
      settings: mockSettings,
      sellers: mockSellers,
      dailySales: tieSales,
      dailyGoals: [],
      dateFilter: resolveDateRangeFilter("today", "2026-10-27"),
      dataSource: "demo-local",
    });

    const luis = snapshot.rankedSellers.find((s) => s.seller.full_name === "Luis");
    const jose = snapshot.rankedSellers.find((s) => s.seller.full_name === "José");
    const carlos = snapshot.rankedSellers.find((s) => s.seller.full_name === "Carlos");

    expect(luis?.rank).toBe(1);
    expect(jose?.rank).toBe(1);
    expect(luis?.medal).toBe("gold");
    expect(jose?.medal).toBe("gold");
    expect(luis?.isTied).toBe(true);
    expect(jose?.isTied).toBe(true);
    expect(carlos?.rank).toBe(3);
    expect(carlos?.medal).toBe("bronze");
  });

  it("5. Cambio de fecha y acumulación multi-día (Sección 8): nuevo día en 0, historial intacto, suma en rangos", () => {
    const historicalSales: DailySaleRecord[] = [
      {
        id: "d1-c",
        seller_id: mockSellers[0]!.id,
        sale_date: "2026-10-26",
        units_sold: 14,
        individual_goal_snapshot: 15,
        version: 1,
        created_at: "2026-10-26T18:00:00.000Z",
        updated_at: "2026-10-26T18:00:00.000Z",
      },
      {
        id: "d2-c",
        seller_id: mockSellers[0]!.id,
        sale_date: "2026-10-27",
        units_sold: 11,
        individual_goal_snapshot: 15,
        version: 1,
        created_at: "2026-10-27T18:00:00.000Z",
        updated_at: "2026-10-27T18:00:00.000Z",
      },
    ];

    const goals: DailyGoalRecord[] = [
      {
        id: "g1",
        goal_date: "2026-10-26",
        general_goal: 50,
        created_at: "2026-10-26T00:00:00.000Z",
        updated_at: "2026-10-26T00:00:00.000Z",
      },
    ];

    // Al comenzar un nuevo día (2026-10-28), empieza en 0 equipos manteniendo vendedores y metas
    const newDaySnapshot = buildSalesBoardSnapshot({
      settings: mockSettings,
      sellers: mockSellers,
      dailySales: historicalSales,
      dailyGoals: goals,
      dateFilter: resolveDateRangeFilter("today", "2026-10-28"),
      dataSource: "demo-local",
    });

    expect(newDaySnapshot.manager.totalUnitsSold).toBe(0);
    expect(newDaySnapshot.manager.generalGoal).toBe(50);
    expect(newDaySnapshot.rankedSellers.every((s) => s.unitsSold === 0)).toBe(true);
    expect(newDaySnapshot.rankedSellers.every((s) => s.medal === "none")).toBe(true);

    // Al consultar el rango personalizado (26 y 27 de octubre), suma sin duplicar: 14 + 11 = 25
    const rangeSnapshot = buildSalesBoardSnapshot({
      settings: mockSettings,
      sellers: mockSellers,
      dailySales: historicalSales,
      dailyGoals: goals,
      dateFilter: resolveDateRangeFilter("custom", "2026-10-28", "2026-10-26", "2026-10-27"),
      dataSource: "demo-local",
    });

    expect(rangeSnapshot.manager.totalUnitsSold).toBe(25);
    expect(rangeSnapshot.manager.generalGoal).toBe(100); // 2 días x 50
    const carlosRange = rangeSnapshot.rankedSellers.find((s) => s.seller.full_name === "Carlos");
    expect(carlosRange?.unitsSold).toBe(25);
    expect(carlosRange?.effectiveGoal).toBe(30); // 2 días x 15
  });

  it("6. Utilidades de fechas (addDays y enumerateDatesBetween)", () => {
    expect(addDaysToDateString("2026-10-27", -1)).toBe("2026-10-26");
    expect(enumerateDatesBetween("2026-10-25", "2026-10-27")).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
    ]);
  });
});
