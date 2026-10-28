import { getSupabaseServerClient } from "@/lib/supabase/server";
import { readDemoDatabase } from "@/lib/demo-store";
import { buildPointsReport } from "@/lib/points-report";
import { pointsReportRangeSchema } from "@/lib/validations";
import type { AuditLogEntry, DailySaleRecord, Seller } from "@/types/salesboard";

// PostgREST limits each response. Read every page; never export a partial report.
async function readAll<T>(getPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < 200000; from += 1000) {
    const result = await getPage(from, from + 999);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
  throw new Error("El reporte es demasiado grande. Selecciona un rango menor.");
}

export async function fetchPointsReport(startDate: string, endDate: string) {
  pointsReportRangeSchema.parse({ startDate, endDate });
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    const db = readDemoDatabase();
    return buildPointsReport({ startDate, endDate, storeName: db.settings.store_name, sellers: db.sellers, sales: db.dailySales, logs: db.auditLogs });
  }
  const [settings, sellers, sales, logs] = await Promise.all([
    supabase.from("app_settings").select("store_name").eq("id", 1).single(),
    readAll<Seller>((from, to) => supabase.from("sellers").select("*").order("id").range(from, to)),
    readAll<DailySaleRecord>((from, to) => supabase.from("daily_sales").select("*").gte("sale_date", startDate).lte("sale_date", endDate).order("sale_date").order("seller_id").range(from, to)),
    readAll<AuditLogEntry>((from, to) => supabase.from("audit_logs").select("*").eq("action_type", "BATCH_DAILY_SALES_UPDATE").gte("sale_date", startDate).lte("sale_date", endDate).order("created_at").order("id").range(from, to)),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  return buildPointsReport({ startDate, endDate, storeName: settings.data.store_name, sellers, sales, logs });
}
