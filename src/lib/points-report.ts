import { enumerateDatesBetween } from "@/lib/date-utils";
import { pointsReportRangeSchema } from "@/lib/validations";
import type { AuditLogEntry, DailySaleRecord, Seller } from "@/types/salesboard";
import type { PointsReport } from "@/types/points-report";

export function buildPointsReport(input: {
  startDate: string; endDate: string; storeName: string;
  sellers: Seller[]; sales: DailySaleRecord[]; logs: AuditLogEntry[];
}): PointsReport {
  const { startDate, endDate } = pointsReportRangeSchema.parse(input);
  const dates = enumerateDatesBetween(startDate, endDate);
  if (dates.length * input.sellers.length > 250000) throw new Error("Reduce el rango para generar el reporte completo.");
  const sellers = [...input.sellers].sort((a, b) => a.display_order - b.display_order || a.full_name.localeCompare(b.full_name, "es"));
  const sales = new Map<string, DailySaleRecord>();
  for (const sale of input.sales) {
    if (sale.sale_date < startDate || sale.sale_date > endDate) continue;
    const key = `${sale.sale_date}:${sale.seller_id}`;
    if (sales.has(key)) throw new Error("El reporte contiene registros diarios duplicados.");
    sales.set(key, sale);
  }
  const totals = new Map(sellers.map((seller) => [seller.id, 0]));
  const days = dates.map((date) => {
    const points: Record<string, number | null> = {};
    let total = 0;
    for (const seller of sellers) {
      const amount = sales.get(`${date}:${seller.id}`)?.units_sold ?? null;
      points[seller.id] = amount;
      if (amount !== null) {
        if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Hay un registro de puntos inválido.");
        total += amount;
        totals.set(seller.id, (totals.get(seller.id) ?? 0) + amount);
      }
    }
    return { date, points, total };
  });
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
  const movements: PointsReport["movements"] = [];
  for (const log of input.logs) {
    if (!log.sale_date || log.sale_date < startDate || log.sale_date > endDate || log.action_type !== "BATCH_DAILY_SALES_UPDATE") continue;
    const normalize = (values: Record<string, unknown> | null) => {
      const raw = values?.sellers ?? values?.changes;
      if (!Array.isArray(raw)) return [];
      return raw.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const row = value as Record<string, unknown>;
        const name = row.seller_name ?? row.seller;
        const matches = sellers.filter((seller) => seller.full_name === name);
        const id = typeof row.seller_id === "string" ? row.seller_id : matches.length === 1 ? matches[0]!.id : null;
        const units = row.units_sold ?? row.units;
        return id && typeof units === "number" && Number.isSafeInteger(units) ? [{ id, units, name: typeof name === "string" ? name : "" }] : [];
      });
    };
    const before = new Map(normalize(log.previous_values).map((row) => [row.id, row.units]));
    const request = log.new_values?.request as { mode?: string } | undefined;
    for (const next of normalize(log.new_values)) {
      const previous = before.get(next.id);
      if (previous === undefined || previous === next.units) continue;
      movements.push({ date: log.sale_date, sellerId: next.id,
        sellerName: next.name || sellerById.get(next.id)?.full_name || next.id,
        type: request?.mode === "add" ? "Suma" : request?.mode === "set" ? "Corrección" : "Actualización anterior",
        points: next.units - previous, previous, total: next.units,
        appliedAt: log.created_at, appliedBy: log.actor_email,
      });
    }
  }
  movements.sort((a, b) => a.date.localeCompare(b.date) || a.appliedAt.localeCompare(b.appliedAt) || a.sellerName.localeCompare(b.sellerName, "es"));
  return { startDate, endDate, storeName: input.storeName, generatedAt: new Date().toISOString(),
    sellers: sellers.map((seller) => ({ id: seller.id, name: seller.full_name, active: seller.is_active, total: totals.get(seller.id) ?? 0 })),
    days, movements, total: days.reduce((sum, day) => sum + day.total, 0),
  };
}
