export type UserRole = "admin" | "viewer";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: number;
  store_name: string;
  board_title: string;
  manager_name: string;
  manager_label: string;
  manager_avatar_url: string | null;
  /** Dato histórico; no interviene en las metas actuales. */
  default_general_goal: number;
  default_monthly_seller_goal?: number;
  default_monthly_manager_goal?: number;
  monthly_seller_prize_name?: string | null;
  monthly_seller_prize_value?: number | null;
  timezone: string;
  is_demo_environment: boolean;
  version: number;
  updated_by?: string | null;
  updated_at: string;
}

export interface Seller {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bar_color: string;
  individual_goal: number;
  is_active: boolean;
  show_on_board: boolean;
  display_order: number;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailySaleRecord {
  id: string;
  seller_id: string;
  sale_date: string; // YYYY-MM-DD
  units_sold: number;
  individual_goal_snapshot: number;
  version: number;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyGoalRecord {
  id: string;
  goal_date: string; // YYYY-MM-DD
  general_goal: number;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action_type:
    | "BATCH_DAILY_SALES_UPDATE"
    | "MONTH_CLOSED"
    | "SELLER_CREATED"
    | "SELLER_UPDATED"
    | "SELLER_STATUS_CHANGED"
    | "MANAGER_SETTINGS_UPDATED"
    | "DEMO_INITIALIZED";
  entity_type: "daily_sales" | "sellers" | "app_settings" | "daily_goals" | "system";
  entity_id: string | null;
  sale_date: string | null;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export type DateFilterPreset = "today" | "yesterday" | "last7days" | "thisMonth" | "custom";

export interface DateRangeFilter {
  preset: DateFilterPreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string;
}

export type RankMedal = "gold" | "silver" | "bronze" | "none";

export interface RankedSellerStat {
  seller: Seller;
  unitsSold: number;
  effectiveGoal: number;
  goalCompletionPercent: number;
  isGoalCompleted: boolean;
  remainingForIndividualGoal: number;
  /** Altura de la barra (0 a 100) proporcional a la mayor cantidad de equipos vendidos (escala común) */
  barHeightPercent: number;
  /** Posición de la meta individual dentro de la escala común (0 a 100) si aplica */
  goalMarkerHeightPercent: number | null;
  /** Posición en el ranking (1, 2, 3...) o null si tiene 0 ventas */
  rank: number | null;
  medal: RankMedal;
  /** Indica si comparte la misma posición con otro vendedor con >0 equipos */
  isTied: boolean;
  lastUpdatedAt: string | null;
  recordVersion: number;
}

export interface ManagerSummaryStat {
  managerName: string;
  managerLabel: string;
  managerAvatarUrl: string | null;
  totalUnitsSold: number;
  generalGoal: number;
  completionPercent: number;
  progressBarWidthPercent: number;
  remainingUnits: number;
  isGoalMet: boolean;
  activeSellersCount: number;
  visibleSellersCount: number;
}

export interface SalesBoardSnapshot {
  settings: AppSettings;
  dateFilter: DateRangeFilter;
  goalMonths?: number;
  manager: ManagerSummaryStat;
  rankedSellers: RankedSellerStat[];
  allSellersAdminTable: RankedSellerStat[];
  lastUpdatedIso: string;
  dataSource: "supabase" | "demo-local";
}
