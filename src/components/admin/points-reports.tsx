"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  RefreshCw,
  Table,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addDaysToDateString,
  formatLongDateSantoDomingo,
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

function formatDayTitle(dateStr: string): string {
  const formatted = formatLongDateSantoDomingo(dateStr);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function PointsReports() {
  const [today] = useState(getSantoDomingoToday);
  const yesterday = useMemo(() => addDaysToDateString(today, -1), [today]);

  // Si hoy es a partir del 30 de octubre de 2026, iniciamos por defecto desde esa fecha
  const initialStartDate = useMemo(() => {
    return today >= "2026-10-30" ? "2026-10-30" : getFirstDayOfMonth(today);
  }, [today]);

  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState<PointsReport | null>(null);
  const [busy, setBusy] = useState<"json" | "xlsx" | null>(null);
  const [error, setError] = useState("");
  const [exported, setExported] = useState(false);

  // Modo de visualización: por día (predeterminado), por vendedor o tabla completa
  const [viewMode, setViewMode] = useState<"by_day" | "by_seller" | "matrix">("by_day");
  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");
  const [hideZeroDays, setHideZeroDays] = useState(true);
  const [showMovementsAudit, setShowMovementsAudit] = useState(false);

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

  // Días ordenados en sentido inverso (el más reciente arriba)
  const daysToDisplay = useMemo(() => {
    if (!report) return [];
    const sorted = [...report.days].sort((a, b) => b.date.localeCompare(a.date));
    if (hideZeroDays) {
      return sorted.filter((d) => d.total > 0 || d.date === today || d.date === yesterday);
    }
    return sorted;
  }, [report, hideZeroDays, today, yesterday]);

  return (
    <section className="space-y-6" aria-label="Historial de puntos">
      <div className="admin-page-heading">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial de puntos por día</h1>
          <p className="mt-1 text-sm text-secondary">
            Consulta clara y simplificada de cuántos puntos se puso cada día a cada persona.
          </p>
        </div>
      </div>

      {/* Controles de Filtros y Rango */}
      <div className="rounded-2xl border border-separator bg-surface p-5 space-y-4 shadow-subtle">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-secondary mr-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Accesos rápidos:
          </span>

          <Button
            type="button"
            size="sm"
            variant={startDate === "2026-10-30" && endDate === today ? "default" : "outline"}
            disabled={Boolean(busy)}
            onClick={() => applyQuickRange("2026-10-30", today)}
          >
            📌 Desde 30 oct (Oficial)
          </Button>

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

        <fieldset disabled={Boolean(busy)} className="flex flex-wrap items-end gap-3 pt-1">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-secondary">
            Desde
            <input
              type="date"
              aria-label="Reporte desde"
              value={startDate}
              max={endDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setExported(false);
              }}
              className="h-9 rounded-lg border border-separator bg-muted px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-secondary">
            Hasta
            <input
              type="date"
              aria-label="Reporte hasta"
              value={endDate}
              min={startDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setExported(false);
              }}
              className="h-9 rounded-lg border border-separator bg-muted px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void generate("json")}
            disabled={Boolean(busy)}
          >
            {busy === "json" ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Actualizar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void generate("xlsx")}
            disabled={Boolean(busy)}
          >
            {busy === "xlsx" ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Exportar Excel
          </Button>
        </fieldset>

        {error && (
          <p role="alert" className="text-xs text-rose-500 font-medium">
            {error}
          </p>
        )}
        {exported && (
          <p role="status" className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Excel descargado correctamente.
          </p>
        )}
      </div>

      {report && (
        <>
          {/* Tarjeta de Resumen Simplificado de Totales */}
          <div className="rounded-2xl border border-separator bg-surface p-5 space-y-3.5 shadow-subtle">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator/70 pb-3">
              <div>
                <span className="text-xs text-secondary font-medium">
                  Total de puntos acumulados ({formatShortDateEs(report.startDate)} al{" "}
                  {formatShortDateEs(report.endDate)})
                </span>
                <p className="text-3xl font-bold tabular-nums text-foreground mt-0.5">
                  {report.total.toLocaleString("es-DO")}{" "}
                  <span className="text-base font-medium text-secondary">puntos</span>
                </p>
              </div>

              {/* Botones selectores de modo de visualización */}
              <div
                className="flex items-center rounded-xl bg-muted p-1 border border-separator"
                role="tablist"
                aria-label="Modo de vista"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "by_day"}
                  onClick={() => setViewMode("by_day")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    viewMode === "by_day"
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-secondary hover:text-foreground"
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Por Día (Día a Día)</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "by_seller"}
                  onClick={() => setViewMode("by_seller")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    viewMode === "by_seller"
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-secondary hover:text-foreground"
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Por Vendedor</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "matrix"}
                  onClick={() => setViewMode("matrix")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    viewMode === "matrix"
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-secondary hover:text-foreground"
                  )}
                >
                  <Table className="h-3.5 w-3.5" />
                  <span>Tabla Resumen</span>
                </button>
              </div>
            </div>

            {/* Fila simplificada con el total de cada persona en el período */}
            <div>
              <span className="text-xs font-semibold text-secondary block mb-2">
                Totales por persona en el período seleccionado:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {report.sellers.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2.5 rounded-xl border border-separator/80 bg-muted/60 p-2 text-xs"
                  >
                    {s.avatar_url ? (
                      <img
                        src={s.avatar_url}
                        alt={s.name}
                        className="h-8 w-8 rounded-full object-cover border border-separator shrink-0"
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-white text-[11px] shrink-0"
                        style={{ backgroundColor: s.bar_color || "#3b82f6" }}
                      >
                        {s.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground truncate block">{s.name}</span>
                      <span className="text-xs font-bold text-accent tabular-nums">
                        {s.total.toLocaleString("es-DO")} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===================================================================
              MODO 1: VISTA POR DÍA (DÍA A DÍA) - SIMPLIFICADA AL MÁXIMO
             =================================================================== */}
          {viewMode === "by_day" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <span className="text-xs font-semibold text-secondary">
                  Mostrando {daysToDisplay.length} día(s) con registro de puntos:
                </span>
                <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hideZeroDays}
                    onChange={(e) => setHideZeroDays(!e.target.checked)}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  Mostrar días sin ventas (0 puntos)
                </label>
              </div>

              {daysToDisplay.length === 0 ? (
                <div className="rounded-2xl border border-separator bg-surface p-8 text-center text-secondary">
                  <Calendar className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm font-medium text-foreground">
                    No hay puntos registrados en este rango de fechas.
                  </p>
                  <p className="text-xs mt-1">
                    Prueba seleccionando el botón <strong>Desde 30 oct</strong> arriba.
                  </p>
                </div>
              ) : (
                daysToDisplay.map((day) => {
                  const isToday = day.date === today;
                  const isYesterday = day.date === yesterday;

                  return (
                    <div
                      key={day.date}
                      className="rounded-2xl border border-separator bg-surface p-5 space-y-4 shadow-subtle transition-all"
                    >
                      {/* Cabecera del Día */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator/70 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent font-bold">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-display text-base font-bold text-foreground">
                                {formatDayTitle(day.date)}
                              </h3>
                              {isToday && (
                                <span className="rounded-full bg-accent text-white px-2.5 py-0.5 text-[11px] font-bold">
                                  Hoy
                                </span>
                              )}
                              {isYesterday && (
                                <span className="rounded-full bg-muted border border-separator text-foreground px-2.5 py-0.5 text-[11px] font-semibold">
                                  Ayer
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-secondary tabular-nums">
                              Fecha: {day.date}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-secondary font-medium">Total del día:</span>
                          <span className="inline-flex items-center rounded-xl bg-accent px-3 py-1.5 text-sm font-bold text-white shadow-sm tabular-nums">
                            {day.total.toLocaleString("es-DO")} puntos
                          </span>
                        </div>
                      </div>

                      {/* Cuadrícula de Vendedores y sus puntos en este día */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
                        {report.sellers.map((seller) => {
                          const pts = day.points[seller.id];
                          const hasPoints = pts !== null && pts !== undefined && pts > 0;

                          return (
                            <div
                              key={seller.id}
                              className={cn(
                                "rounded-xl border p-3 flex flex-col items-center text-center transition-all",
                                hasPoints
                                  ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20 shadow-xs"
                                  : "border-separator/60 bg-muted/40 opacity-70"
                              )}
                            >
                              {seller.avatar_url ? (
                                <img
                                  src={seller.avatar_url}
                                  alt={seller.name}
                                  className="h-10 w-10 rounded-full object-cover border border-separator shadow-xs mb-1.5"
                                />
                              ) : (
                                <div
                                  className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-white text-xs mb-1.5 shadow-xs"
                                  style={{ backgroundColor: seller.bar_color || "#3b82f6" }}
                                >
                                  {seller.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}

                              <span className="text-xs font-semibold text-foreground truncate max-w-full">
                                {seller.name}
                              </span>

                              <div className="mt-1.5">
                                {hasPoints ? (
                                  <span className="inline-block rounded-lg bg-accent text-white px-2.5 py-0.5 text-xs font-bold tabular-nums shadow-xs">
                                    +{pts.toLocaleString("es-DO")} pts
                                  </span>
                                ) : pts === 0 ? (
                                  <span className="text-xs text-secondary tabular-nums font-medium">
                                    0 pts
                                  </span>
                                ) : (
                                  <span className="text-xs text-secondary/60 tabular-nums">
                                    —
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ===================================================================
              MODO 2: VISTA POR VENDEDOR
             =================================================================== */}
          {viewMode === "by_seller" && (
            <div className="rounded-2xl border border-separator bg-surface p-5 space-y-4 shadow-subtle">
              {/* Filtro por persona */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-separator/70 pb-3">
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
                      return pts !== null && pts !== undefined && pts > 0;
                    });

                  return (
                    <div
                      key={seller.id}
                      className="rounded-xl border border-separator bg-muted/40 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-separator pb-2.5">
                        <div className="flex items-center gap-2.5">
                          {seller.avatar_url ? (
                            <img
                              src={seller.avatar_url}
                              alt={seller.name}
                              className="h-10 w-10 rounded-full object-cover border border-separator shrink-0"
                            />
                          ) : (
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                              style={{ backgroundColor: seller.bar_color || "#3b82f6" }}
                            >
                              {seller.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 className="font-display text-sm font-bold text-foreground">
                              {seller.name}
                            </h3>
                            <span className="text-xs text-secondary">
                              {sellerDays.length} día(s) con ventas registradas
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-secondary block font-medium">Total</span>
                          <strong className="font-display text-lg font-bold tabular-nums text-accent">
                            {seller.total.toLocaleString("es-DO")} pts
                          </strong>
                        </div>
                      </div>

                      {sellerDays.length === 0 ? (
                        <p className="py-3 text-center text-xs text-secondary">
                          Sin puntos registrados en este rango de fechas.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {sellerDays.map((day) => {
                            const pts = day.points[seller.id];
                            return (
                              <div
                                key={day.date}
                                className="flex items-center justify-between rounded-lg border border-separator bg-surface px-3 py-2 text-xs"
                              >
                                <span className="font-medium text-foreground">
                                  {formatDayTitle(day.date)}
                                </span>
                                <span className="font-bold text-accent tabular-nums">
                                  +{pts?.toLocaleString("es-DO")} pts
                                </span>
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
          )}

          {/* ===================================================================
              MODO 3: TABLA RESUMEN COMPLETA
             =================================================================== */}
          {viewMode === "matrix" && (
            <div className="rounded-2xl border border-separator bg-surface overflow-hidden shadow-subtle">
              <div className="p-4 border-b border-separator/70">
                <h2 className="text-base font-semibold text-foreground">
                  Tabla de puntos por día y vendedor
                </h2>
                <p className="text-xs text-secondary">
                  Matriz consolidada con las fechas y los puntos correspondientes a cada persona.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-secondary font-semibold border-b border-separator">
                    <tr>
                      <th className="p-3">Fecha</th>
                      {report.sellers.map((seller) => (
                        <th className="p-3 text-center" key={seller.id}>
                          {seller.name}
                        </th>
                      ))}
                      <th className="p-3 text-right">Total Día</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysToDisplay.map((day) => (
                      <tr key={day.date} className="border-t border-separator/60 hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap font-medium text-foreground">
                          {formatDayTitle(day.date)}
                        </td>
                        {report.sellers.map((seller) => {
                          const pts = day.points[seller.id];
                          return (
                            <td
                              className={cn(
                                "p-3 text-center tabular-nums font-semibold",
                                pts && pts > 0 ? "text-accent" : "text-secondary/60"
                              )}
                              key={seller.id}
                            >
                              {pts !== null && pts !== undefined
                                ? pts > 0
                                  ? `+${pts.toLocaleString("es-DO")}`
                                  : "0"
                                : "—"}
                            </td>
                          );
                        })}
                        <td className="p-3 text-right font-bold tabular-nums text-foreground">
                          {day.total.toLocaleString("es-DO")} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted font-bold border-t-2 border-separator">
                    <tr>
                      <td className="p-3">TOTAL GENERAL</td>
                      {report.sellers.map((seller) => (
                        <td className="p-3 text-center tabular-nums text-accent" key={seller.id}>
                          {seller.total.toLocaleString("es-DO")} pts
                        </td>
                      ))}
                      <td className="p-3 text-right tabular-nums text-foreground">
                        {report.total.toLocaleString("es-DO")} pts
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ===================================================================
              SECCIÓN COLAPSABLE: AUDITORÍA DE MOVIMIENTOS Y CIERRES DE MES
             =================================================================== */}
          <div className="rounded-2xl border border-separator bg-surface p-4 shadow-subtle">
            <button
              type="button"
              onClick={() => setShowMovementsAudit(!showMovementsAudit)}
              className="flex w-full items-center justify-between text-xs font-semibold text-secondary hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <History className="h-4 w-4" />
                Auditoría detallada de horas y cambios ({report.movements.length} operaciones)
              </span>
              {showMovementsAudit ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showMovementsAudit && (
              <div className="mt-4 space-y-4 pt-3 border-t border-separator/70">
                {report.closures && report.closures.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground">Cierres de mes anteriores:</h4>
                    {report.closures.map((closure) => (
                      <div
                        key={closure.id}
                        className="rounded-xl border border-separator bg-muted/50 p-3 text-xs space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-foreground">
                            Cierre ({formatShortDateEs(closure.periodStart)} al{" "}
                            {formatShortDateEs(closure.periodEnd)})
                          </strong>
                          <span className="font-bold text-accent tabular-nums">
                            Total: {closure.totalPoints.toLocaleString("es-DO")} pts
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-secondary text-[11px]">
                          {closure.sellers.map((s) => (
                            <span key={s.sellerId}>
                              {s.sellerName}: <strong>{s.monthPoints} pts</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted text-secondary">
                      <tr>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Vendedor</th>
                        <th className="p-2">Operación</th>
                        <th className="p-2 text-right">Puntos</th>
                        <th className="p-2">Hora</th>
                        <th className="p-2">Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...report.movements].reverse().map((mov, idx) => (
                        <tr key={`${mov.appliedAt}-${idx}`} className="border-t border-separator/60">
                          <td className="p-2 whitespace-nowrap">{formatShortDateEs(mov.date)}</td>
                          <td className="p-2 font-medium">{mov.sellerName}</td>
                          <td className="p-2">{mov.type}</td>
                          <td className="p-2 text-right font-bold tabular-nums text-accent">
                            {mov.points >= 0 ? `+${mov.points}` : mov.points}
                          </td>
                          <td className="p-2 whitespace-nowrap text-secondary">
                            {formatTimeSantoDomingo(mov.appliedAt)}
                          </td>
                          <td className="p-2 text-secondary">{mov.appliedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
