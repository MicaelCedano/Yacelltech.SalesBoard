import fs from "fs";
import path from "path";
import {
  AppSettings,
  AuditLogEntry,
  DailyGoalRecord,
  DailySaleRecord,
  Seller,
} from "@/types/salesboard";
import { addDaysToDateString, getSantoDomingoToday } from "@/lib/date-utils";

export interface LocalDemoDatabase {
  settings: AppSettings;
  sellers: Seller[];
  dailySales: DailySaleRecord[];
  dailyGoals: DailyGoalRecord[];
  auditLogs: AuditLogEntry[];
}

const DEMO_DIR = path.join(process.cwd(), ".demo-data");
const DEMO_FILE = path.join(DEMO_DIR, "sandbox-db.json");

export const DEMO_SELLER_IDS = {
  luis: "33333333-3333-4333-8333-333333333333",
  jose: "55555555-5555-4555-8555-555555555555",
  carlos: "11111111-1111-4111-8111-111111111111",
  ana: "22222222-2222-4222-8222-222222222222",
  maria: "44444444-4444-4444-8444-444444444444",
} as const;

/**
 * Construye una base de datos de demostración inicial limpia y coherente.
 * Incluye los 5 vendedores del requerimiento: Carlos, Ana, Luis, María y José.
 */
export function createSeedDemoDatabase(
  preset: "daily_34_of_50" | "high_volume_350" = "daily_34_of_50",
  referenceToday: string = getSantoDomingoToday()
): LocalDemoDatabase {
  const nowIso = new Date().toISOString();
  const yesterday = addDaysToDateString(referenceToday, -1);
  const twoDaysAgo = addDaysToDateString(referenceToday, -2);
  const threeDaysAgo = addDaysToDateString(referenceToday, -3);

  const isHighVolume = preset === "high_volume_350";
  const defaultGoal = isHighVolume ? 1000 : 50;
  const sellerGoal = isHighVolume ? 250 : 15;

  const settings: AppSettings = {
    id: 1,
    store_name: "YACELLTECH",
    board_title: "Ranking de puntos",
    manager_name: "Roberto Méndez",
    manager_label: "MANAGER GENERAL",
    manager_avatar_url:
      "https://api.dicebear.com/9.x/avataaars/svg?seed=RobertoManagerYacell&backgroundColor=0284c7",
    default_general_goal: defaultGoal,
    timezone: "America/Santo_Domingo",
    is_demo_environment: true,
    version: 1,
    updated_at: nowIso,
  };

  const sellers: Seller[] = [
    {
      id: DEMO_SELLER_IDS.luis,
      full_name: "Luis",
      avatar_url:
        "https://api.dicebear.com/9.x/avataaars/svg?seed=LuisYacell&backgroundColor=0ea5e9",
      bar_color: "#38BDF8",
      individual_goal: sellerGoal,
      is_active: true,
      show_on_board: true,
      display_order: 1,
      is_demo: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: DEMO_SELLER_IDS.jose,
      full_name: "José",
      avatar_url:
        "https://api.dicebear.com/9.x/avataaars/svg?seed=JoseYacell&backgroundColor=8b5cf6",
      bar_color: "#A855F7",
      individual_goal: sellerGoal,
      is_active: true,
      show_on_board: true,
      display_order: 2,
      is_demo: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: DEMO_SELLER_IDS.carlos,
      full_name: "Carlos",
      avatar_url:
        "https://api.dicebear.com/9.x/avataaars/svg?seed=CarlosYacell&backgroundColor=10b981",
      bar_color: "#10B981",
      individual_goal: sellerGoal,
      is_active: true,
      show_on_board: true,
      display_order: 3,
      is_demo: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: DEMO_SELLER_IDS.ana,
      full_name: "Ana",
      avatar_url:
        "https://api.dicebear.com/9.x/avataaars/svg?seed=AnaYacell&backgroundColor=ec4899",
      bar_color: "#EC4899",
      individual_goal: sellerGoal,
      is_active: true,
      show_on_board: true,
      display_order: 4,
      is_demo: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: DEMO_SELLER_IDS.maria,
      full_name: "María",
      avatar_url:
        "https://api.dicebear.com/9.x/avataaars/svg?seed=MariaYacell&backgroundColor=f97316",
      bar_color: "#F97316",
      individual_goal: sellerGoal,
      is_active: true,
      show_on_board: true,
      display_order: 5,
      is_demo: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  // Cantidades para hoy según el preset elegido
  // Preset "daily_34_of_50": Luis 11, José 9, Carlos 7, Ana 4, María 3 = 34 equipos (68% de 50, faltan 16)
  // Preset "high_volume_350": Luis 350, José 250, Carlos 210, Ana 60, María 50 = 920 equipos (de 1000)
  const todayUnits = isHighVolume
    ? {
        [DEMO_SELLER_IDS.luis]: 350,
        [DEMO_SELLER_IDS.jose]: 250,
        [DEMO_SELLER_IDS.carlos]: 210,
        [DEMO_SELLER_IDS.ana]: 60,
        [DEMO_SELLER_IDS.maria]: 50,
      }
    : {
        [DEMO_SELLER_IDS.carlos]: 12,
        [DEMO_SELLER_IDS.ana]: 6,
        [DEMO_SELLER_IDS.luis]: 8,
        [DEMO_SELLER_IDS.maria]: 3,
        [DEMO_SELLER_IDS.jose]: 5,
      };

  const yesterdayUnits = {
    [DEMO_SELLER_IDS.luis]: 16,
    [DEMO_SELLER_IDS.jose]: 14,
    [DEMO_SELLER_IDS.carlos]: 13,
    [DEMO_SELLER_IDS.ana]: 9,
    [DEMO_SELLER_IDS.maria]: 7,
  };

  const twoDaysAgoUnits = {
    [DEMO_SELLER_IDS.luis]: 12,
    [DEMO_SELLER_IDS.jose]: 15,
    [DEMO_SELLER_IDS.carlos]: 10,
    [DEMO_SELLER_IDS.ana]: 8,
    [DEMO_SELLER_IDS.maria]: 6,
  };

  const threeDaysAgoUnits = {
    [DEMO_SELLER_IDS.luis]: 14,
    [DEMO_SELLER_IDS.jose]: 11,
    [DEMO_SELLER_IDS.carlos]: 12,
    [DEMO_SELLER_IDS.ana]: 7,
    [DEMO_SELLER_IDS.maria]: 5,
  };

  const dailySales: DailySaleRecord[] = [];
  const addDaySales = (dateStr: string, unitsMap: Record<string, number>, goalVal: number) => {
    for (const [sellerId, units] of Object.entries(unitsMap)) {
      dailySales.push({
        id: `demo-sale-${sellerId}-${dateStr}`,
        seller_id: sellerId,
        sale_date: dateStr,
        units_sold: units,
        individual_goal_snapshot: goalVal,
        version: 1,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  };

  addDaySales(referenceToday, todayUnits, sellerGoal);
  addDaySales(yesterday, yesterdayUnits, 15);
  addDaySales(twoDaysAgo, twoDaysAgoUnits, 15);
  addDaySales(threeDaysAgo, threeDaysAgoUnits, 15);

  const dailyGoals: DailyGoalRecord[] = [
    {
      id: `goal-${referenceToday}`,
      goal_date: referenceToday,
      general_goal: defaultGoal,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: `goal-${yesterday}`,
      goal_date: yesterday,
      general_goal: 50,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: `goal-${twoDaysAgo}`,
      goal_date: twoDaysAgo,
      general_goal: 50,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: `goal-${threeDaysAgo}`,
      goal_date: threeDaysAgo,
      general_goal: 50,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: "audit-init-demo",
      actor_id: "00000000-0000-4000-8000-000000000001",
      actor_email: "admin@yacelltech.com",
      action_type: "DEMO_INITIALIZED",
      entity_type: "system",
      entity_id: "demo-seed",
      sale_date: referenceToday,
      previous_values: null,
      new_values: {
        preset,
        sellers_count: 5,
        general_goal: defaultGoal,
      },
      created_at: nowIso,
    },
  ];

  return {
    settings,
    sellers,
    dailySales,
    dailyGoals,
    auditLogs,
  };
}

let inMemoryFallback: LocalDemoDatabase | null = null;

export function readDemoDatabase(): LocalDemoDatabase {
  try {
    if (fs.existsSync(DEMO_FILE)) {
      const raw = fs.readFileSync(DEMO_FILE, "utf-8");
      const parsed = JSON.parse(raw) as LocalDemoDatabase;
      inMemoryFallback = parsed;
      return parsed;
    }
  } catch {
    // Si el sistema de archivos es de solo lectura (ej. serverless), usar memoria
  }

  if (!inMemoryFallback) {
    inMemoryFallback = createSeedDemoDatabase("daily_34_of_50");
    writeDemoDatabase(inMemoryFallback);
  }
  return inMemoryFallback;
}

export function writeDemoDatabase(db: LocalDemoDatabase): void {
  inMemoryFallback = db;
  try {
    if (!fs.existsSync(DEMO_DIR)) {
      fs.mkdirSync(DEMO_DIR, { recursive: true });
    }
    fs.writeFileSync(DEMO_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // En entornos serverless sin escritura en disco, se mantiene en inMemoryFallback
  }
}
