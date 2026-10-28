"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Download, History, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addDaysToDateString,
  formatShortDateEs,
  formatTimeSantoDomingo,
  getFirstDayOfMonth,
  getSantoDomingoToday,
} from "@/lib/date-utils";
import { pointsReportRangeSchema } from "@/lib/validations";
import type { PointsReport } from "@/types/points-report";
import { cn } from "@/lib/utils";

function getPreviousMonthRange(todayStr: string): { start: string; end: string } {
  const firstOfThisMonth = getFirstDayOfMonth(todayStr);
  const lastOfPrevMonth = addDaysToDateString(firstOfThisMonth, -1);
  const firstOfPrevMonth = getFirstDayOfMonth(lastOfPrevMonth);
  return { start: firstOfPrevMonth, end: lastOfPrevMonth };
}

export function PointsReports() {
  const [today] = useState(getSantoDomingoToday);
  const yesterday = useMemo(() => addDaysToDateString(today, -1), [today]);
  const [startDate, setStartDate] = useState(getFirstDayOfMonth(today));
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState<PointsReport | null>(null);
  const [busy, setBusy] = useState<"json" | "xlsx" | null>(null);
  const [error, setError] = useState("");
  const [exported, setExported] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");
  const [showEmptyDaysPerSeller, setShowEmptyDaysPerSeller] = useState(false);

  const generate = useCallback(
    async (format: "json" | "xlsx", customStart?: string, customEnd?: string) => {
      const rangeStart = customStart ?? startDate;
      const rangeEnd = customEnd ?? endDate;
      setError("");
      if (format === "xlsx") setExported(false);
      const parsed = pointsReportRangeSchema.safeParse({
        startDate: rangeStart,
        endDate: rangeEnd,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Rango inválido");
        return;
      }
      setBusy(format);
      try {
        const response = await fetch(
          `/api/admin/reports?${new URLSearchParams({
            startDate: rangeStart,
            endDate: rangeEnd,
            format,
          })}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error ?? "No se pudo generar el reporte");
        }
        if (format === "json") {
          setReport(await response.json());
        } else {
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement("a");
          link.href = url;
          link.download = `YacellTech-puntos-${rangeStart}-a-${rangeEnd}.xlsx`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 30000);
          setExported(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al consultar");
      } finally {
        setBusy(null);
      }
    },
    [startDate, endDate]
  );

  // Cargar automáticamente el historial en pantalla sin necesidad de descargar Excel
  useEffect(() => {
    void generate("json", startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyQuickRange = (nextStart: string, nextEnd: string) => {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setExported(false);
    void generate("json", nextStart, nextEnd);
  };

  const prevMonth = useMemo(() => getPreviousMonthRange(today), [today]);

  const filteredSellers = useMemo(() => {
    if (!report) return [];
    if (selectedSellerId === "all") return report.sellers;
    return report.sellers.filter((s) => s.id === selectedSellerId);
  }, [report, selectedSellerId]);

  const movementsBySellerAndDate = useMemo(() => {
    const map = new Map<string, PointsReport["movements"]>();
    if (!report) return map;
    for (const mov of report.movements) {
      const key = `${mov.sellerId}:${mov.date}`;
      const list = map.get(key) ?? [];
      list.push(mov);
      map.set(key, list);
    }
    return map;
  }, [report]);

  return (
    <section className="space-y-6" aria-label="Reportes de puntos">
      <div className="admin-page-heading">
        <div>
          <h1>Historial completo y Reporte de puntos</h1>
          <p>
            Consulta en pantalla cuánto se le dio cada día a cada persona sin necesidad de usar Excel, o descarga el archivo Excel cuando lo necesites.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-separator bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-secondary mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Consulta rápida:
          </span>
          <Button
            type="button"
            size="sm"
            variant={startDate === yesterday && endDate === yesterday ? "default" : "outline"}
            disabled={Boolean(busy)}
            onClick={() => applyQuickRange(yesterday, yesterday)}
          >
            Ayer ({formatShortDateEs(yesterday)})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={startDate === today && endDate === today ? "default" : "outline"}
            disabled={Boolean(busy)}
            onClick={() => applyQuickRange(today, today)}
          >
            Hoy ({formatShortDateEs(today)})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={
              startDate === addDaysToDateString(today, -6) && endDate === today
                ? "default"
                : "outline"
            }
            disabled={Boolean(busy)}
            onClick={() => applyQuickRange(addDaysToDateString(today, -6), today)}
          >
            Últimos 7 días
          </Button>
          <Button
            type="button"
            size="sm"
            variant={
              startDate === getFirstDayOfMonth(today) && endDate === today
                ? "default"
                : "outline"
            }
            disabled={Boolean(busy)}
            onClick={() => applyQuickRange(getFirstDayOfMonth(today), today)}
          >
            Este mes
          </Button>
          <Button
            type="button"
            size="sm"
            variant={
              startDate === prevMonth.start && endDate === prevMonth.end
                ? "default"
                : "outline"
            }
            disabled={Boolean(busy)}
            onClick={() => applyQuickRange(prevMonth.start, prevMonth.end)}
          >
            Mes anterior
          </Button>
        </div>

        <fieldset disabled={Boolean(busy)} className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-2 text-sm">
            Desde
            <input
              type="date"
              aria-label="Reporte desde"
              value={startDate}
              max={endDate}
              onInput={(event) => {
                setStartDate(event.currentTarget.value);
                setExported(false);
              }}
              onChange={(event) => {
                setStartDate(event.target.value);
                setExported(false);
              }}
              className="h-10 rounded-lg border border-separator bg-muted px-3"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Hasta
            <input
              type="date"
              aria-label="Reporte hasta"
              value={endDate}
              min={startDate}
              onInput={(event) => {
                setEndDate(event.currentTarget.value);
                setExported(false);
              }}
              onChange={(event) => {
                setEndDate(event.target.value);
                setExported(false);
              }}
              className="h-10 rounded-lg border border-separator bg-muted px-3"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => void generate("json")}
            disabled={Boolean(busy)}
          >
            {busy === "json" && <RefreshCw className="h-4 w-4 animate-spin" />}
            Ver reporte
          </Button>
          <Button
            type="button"
            onClick={() => void generate("xlsx")}
            disabled={Boolean(busy)}
          >
            {busy === "xlsx" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void generate("xlsx", yesterday, yesterday)}
            disabled={Boolean(busy)}
            title="Descargar directamente en Excel los puntos del día anterior"
          >
            <Download className="h-4 w-4" />
            Excel del día anterior ({formatShortDateEs(yesterday)})
          </Button>
        </fieldset>

        <p className="text-sm text-secondary">
          Ambas fechas incluidas · Hasta 366 días · Incluye vendedores activos, inactivos y ocultos en TV.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        )}
        {exported && (
          <p role="status" className="text-sm text-success-text flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Excel generado correctamente. Revisa las descargas del navegador.
          </p>
        )}
      </div>

      {report && (
        <>
          {/* Resumen general del período */}
          <div className="rounded-2xl border border-separator bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-secondary">
                  Total acumulado del {formatShortDateEs(report.startDate)} al{" "}
                  {formatShortDateEs(report.endDate)}
                </p>
                <p className="text-4xl font-semibold tabular-nums mt-2">
                  {report.total.toLocaleString("es-DO")} puntos
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.sellers.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-separator bg-muted px-3.5 py-2 text-xs"
                  >
                    <span className="text-secondary block">{s.name}</span>
                    <strong className="text-base tabular-nums text-foreground">
                      {s.total.toLocaleString("es-DO")} pts
                    </strong>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm text-secondary mt-3">
              {report.movements.length} aplicaciones o correcciones detalladas en auditoría
              {report.closures && report.closures.length > 0
                ? ` · ${report.closures.length} cierre(s) de mes registrados en este rango`
                : ""}
              .
            </p>
          </div>

          {/* HISTORIAL COMPLETO POR PERSONA (SIN NECESIDAD DE EXCEL) */}
          <div className="rounded-2xl border border-separator bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator pb-4">
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <User className="h-5 w-5 text-accent" />
                  <span>Historial por persona (cuánto se dio cada día)</span>
                </h2>
                <p className="text-xs text-secondary mt-1">
                  Detalle completo por vendedor con los puntos dados cada día y cada suma aplicada.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEmptyDaysPerSeller}
                  onChange={(e) => setShowEmptyDaysPerSeller(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Mostrar también días sin puntos
              </label>
            </div>

            {/* Filtro por persona */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por vendedor">
              <button
                type="button"
                onClick={() => setSelectedSellerId("all")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  selectedSellerId === "all"
                    ? "bg-accent text-white"
                    : "bg-muted text-secondary hover:text-foreground"
                )}
              >
                Todos ({report.sellers.length})
              </button>
              {report.sellers.map((seller) => (
                <button
                  key={seller.id}
                  type="button"
                  onClick={() => setSelectedSellerId(seller.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    selectedSellerId === seller.id
                      ? "bg-accent text-white"
                      : "bg-muted text-secondary hover:text-foreground"
                  )}
                >
                  {seller.name} ({seller.total.toLocaleString("es-DO")} pts)
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredSellers.map((seller) => {
                const sellerDays = [...report.days]
                  .reverse()
                  .filter((day) => {
                    const pts = day.points[seller.id];
                    if (showEmptyDaysPerSeller) return true;
                    return pts !== null && pts !== undefined && pts > 0;
                  });

                return (
                  <div
                    key={seller.id}
                    className="rounded-xl border border-separator bg-muted/50 p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-separator pb-2.5">
                      <div>
                        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                          <span>{seller.name}</span>
                          {!seller.active && (
                            <span className="rounded bg-warning-soft px-2 py-0.5 text-[10px] font-normal text-warning-text">
                              Inactivo
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-secondary">
                          Historial del {formatShortDateEs(report.startDate)} al{" "}
                          {formatShortDateEs(report.endDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-secondary block">Total acumulado</span>
                        <strong className="font-display text-xl font-bold tabular-nums text-accent">
                          {seller.total.toLocaleString("es-DO")} pts
                        </strong>
                      </div>
                    </div>

                    {sellerDays.length === 0 ? (
                      <p className="py-4 text-center text-xs text-secondary">
                        Sin puntos registrados para {seller.name} en este rango de fechas.
                      </p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                        {sellerDays.map((day) => {
                          const pts = day.points[seller.id];
                          const dayMovements =
                            movementsBySellerAndDate.get(`${seller.id}:${day.date}`) ?? [];
                          const isYesterday = day.date === yesterday;
                          const isToday = day.date === today;

                          return (
                            <div
                              key={day.date}
                              className="rounded-lg border border-separator bg-surface px-3 py-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">
                                    {formatShortDateEs(day.date)}
                                  </span>
                                  <span className="text-[11px] text-secondary tabular-nums">
                                    ({day.date})
                                  </span>
                                  {isToday && (
                                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                                      Hoy
                                    </span>
                                  )}
                                  {isYesterday && (
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-secondary">
                                      Ayer
                                    </span>
                                  )}
                                </div>
                                <strong className="text-sm font-semibold tabular-nums text-foreground">
                                  {pts === null || pts === undefined
                                    ? "Sin registro"
                                    : `${pts.toLocaleString("es-DO")} puntos`}
                                </strong>
                              </div>

                              {dayMovements.length > 0 && (
                                <div className="mt-1.5 border-t border-separator pt-1.5 space-y-1">
                                  {dayMovements.map((mov, idx) => (
                                    <div
                                      key={`${mov.appliedAt}-${idx}`}
                                      className="flex flex-wrap items-center justify-between text-[11px] text-secondary"
                                    >
                                      <span>
                                        {mov.type}:{" "}
                                        <strong
                                          className={
                                            mov.points >= 0
                                              ? "text-success-text"
                                              : "text-danger-text"
                                          }
                                        >
                                          {mov.points >= 0 ? `+${mov.points}` : mov.points} pts
                                        </strong>{" "}
                                        ({mov.previous} → {mov.total})
                                      </span>
                                      <span className="tabular-nums">
                                        {formatTimeSantoDomingo(mov.appliedAt)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* TABLA MATRIZ: PUNTOS POR DÍA Y VENDEDOR */}
          <div className="rounded-2xl border border-separator bg-surface overflow-hidden">
            <div className="p-5">
              <h2 className="text-lg font-medium">Puntos por día y vendedor</h2>
              <p className="text-xs text-secondary mt-1">
                — significa sin registro; 0 es un registro guardado con cero puntos.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3">Fecha</th>
                    {report.sellers.map((seller) => (
                      <th className="p-3" key={seller.id}>
                        {seller.name}
                        {!seller.active && (
                          <small className="block font-normal">Inactivo</small>
                        )}
                      </th>
                    ))}
                    <th className="p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((day) => (
                    <tr key={day.date} className="border-t border-separator">
                      <td className="p-3 whitespace-nowrap">
                        <span>{day.date}</span>
                        {day.date === yesterday && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-secondary">
                            Ayer
                          </span>
                        )}
                        {day.date === today && (
                          <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                            Hoy
                          </span>
                        )}
                      </td>
                      {report.sellers.map((seller) => (
                        <td className="p-3 tabular-nums" key={seller.id}>
                          {day.points[seller.id]?.toLocaleString("es-DO") ?? "—"}
                        </td>
                      ))}
                      <td className="p-3 font-semibold tabular-nums">
                        {day.total.toLocaleString("es-DO")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted font-semibold">
                  <tr>
                    <th className="p-3">Total</th>
                    {report.sellers.map((seller) => (
                      <td className="p-3 tabular-nums" key={seller.id}>
                        {seller.total.toLocaleString("es-DO")}
                      </td>
                    ))}
                    <td className="p-3 tabular-nums">
                      {report.total.toLocaleString("es-DO")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* CIERRES DE MES EN EL PERÍODO (SI EXISTEN) */}
          {report.closures && report.closures.length > 0 && (
            <div className="rounded-2xl border border-separator bg-surface p-5 space-y-3">
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <History className="h-5 w-5 text-accent" />
                  <span>Cierres de mes y reinicios de pantalla</span>
                </h2>
                <p className="text-xs text-secondary mt-1">
                  Registro de cada vez que se cerró el mes para pagar puntos y empezar a sumar desde cero.
                </p>
              </div>
              <div className="space-y-3">
                {report.closures.map((closure) => (
                  <div
                    key={closure.id}
                    className="rounded-xl border border-separator bg-muted p-4 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator pb-2">
                      <div>
                        <strong className="text-sm text-foreground">
                          Cierre de mes ({formatShortDateEs(closure.periodStart)} al{" "}
                          {formatShortDateEs(closure.periodEnd)})
                        </strong>
                        <span className="ml-2 text-secondary">
                          · Cerrado por {closure.closedBy}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <strong className="text-sm text-accent tabular-nums">
                          Total cerrado: {closure.totalPoints.toLocaleString("es-DO")} puntos
                        </strong>
                        <span className="text-secondary tabular-nums">
                          {formatShortDateEs(closure.closedDate)} ·{" "}
                          {formatTimeSantoDomingo(closure.closedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {closure.sellers.map((s) => (
                        <div
                          key={s.sellerId}
                          className="rounded-lg border border-separator bg-surface px-3 py-1.5"
                        >
                          <span className="text-secondary">{s.sellerName}: </span>
                          <strong className="text-foreground tabular-nums">
                            {s.monthPoints.toLocaleString("es-DO")} pts
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DESGLOSE DE SUMAS Y MOVIMIENTOS INDIVIDUALES */}
          <div className="rounded-2xl border border-separator bg-surface overflow-hidden">
            <div className="p-5">
              <h2 className="text-lg font-medium">
                Registro detallado de sumas y correcciones ({report.movements.length})
              </h2>
              <p className="text-xs text-secondary mt-1">
                Cada vez que se sumaron o corrigieron puntos con su fecha, hora exacta y cantidad aplicada.
              </p>
            </div>
            {report.movements.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-secondary">
                No hay movimientos individuales registrados en auditoría para este rango.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-xs text-secondary">
                    <tr>
                      <th className="p-3">Fecha puntos</th>
                      <th className="p-3">Vendedor</th>
                      <th className="p-3">Operación</th>
                      <th className="p-3 text-right">Puntos dados</th>
                      <th className="p-3 text-right">Antes → Después</th>
                      <th className="p-3">Hora aplicación</th>
                      <th className="p-3">Administrador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...report.movements].reverse().map((mov, index) => (
                      <tr
                        key={`${mov.appliedAt}-${mov.sellerId}-${index}`}
                        className="border-t border-separator"
                      >
                        <td className="p-3 whitespace-nowrap tabular-nums">
                          {formatShortDateEs(mov.date)} ({mov.date})
                        </td>
                        <td className="p-3 font-medium">{mov.sellerName}</td>
                        <td className="p-3">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-xs font-medium",
                              mov.type === "Suma"
                                ? "bg-accent-soft text-accent"
                                : "bg-muted text-secondary"
                            )}
                          >
                            {mov.type}
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold tabular-nums">
                          {mov.points >= 0
                            ? `+${mov.points.toLocaleString("es-DO")}`
                            : mov.points.toLocaleString("es-DO")}
                        </td>
                        <td className="p-3 text-right tabular-nums text-secondary">
                          {mov.previous.toLocaleString("es-DO")} →{" "}
                          <strong className="text-foreground">
                            {mov.total.toLocaleString("es-DO")}
                          </strong>
                        </td>
                        <td className="p-3 whitespace-nowrap text-xs text-secondary tabular-nums">
                          {formatShortDateEs(mov.appliedAt.slice(0, 10))} ·{" "}
                          {formatTimeSantoDomingo(mov.appliedAt)}
                        </td>
                        <td className="p-3 text-xs text-secondary">{mov.appliedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
