"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Maximize2, Minimize2 } from "lucide-react";
import { DateFilterPreset, SalesBoardSnapshot } from "@/types/salesboard";
import { useSalesBoardRealtime } from "@/hooks/use-salesboard-realtime";
import { formatLongDateSantoDomingo, formatShortDateEs, formatTimeSantoDomingo, getSantoDomingoToday, getTimeShiftSantoDomingo } from "@/lib/date-utils";
import { ManagerCard } from "@/components/board/manager-card";
import { VerticalSellersChart } from "@/components/board/vertical-sellers-chart";
import { ThemeToggle } from "@/components/ui/appearance-provider";
import { YacellTechLogo } from "@/components/ui/yacelltech-logo";

interface PublicMovementBatch {
  appliedAt: string;
  timeStr: string;
  shiftLabel: "Mañana" | "Tarde";
  shiftIcon: string;
  appliedBy: string;
  type: string;
  date: string;
  totalPointsBatch: number;
  items: {
    sellerId: string;
    sellerName: string;
    previous: number;
    points: number;
    total: number;
    type: string;
  }[];
}

function groupPublicMovements(
  movements: NonNullable<SalesBoardSnapshot["movements"]>
): PublicMovementBatch[] {
  if (!movements.length) return [];
  const sorted = [...movements].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  const batches: PublicMovementBatch[] = [];

  for (const m of sorted) {
    const existing = batches.find((b) => {
      const diff = Math.abs(
        new Date(b.appliedAt).getTime() - new Date(m.appliedAt).getTime()
      );
      return diff < 5000 && b.type === m.type && b.date === m.date;
    });

    if (existing) {
      existing.items.push({
        sellerId: m.sellerId,
        sellerName: m.sellerName,
        previous: m.previous,
        points: m.points,
        total: m.total,
        type: m.type,
      });
      existing.totalPointsBatch += m.points;
    } else {
      const shift = getTimeShiftSantoDomingo(m.appliedAt);
      batches.push({
        appliedAt: m.appliedAt,
        timeStr: formatTimeSantoDomingo(m.appliedAt),
        shiftLabel: shift.label,
        shiftIcon: shift.icon,
        appliedBy: m.appliedBy,
        type: m.type,
        date: m.date,
        totalPointsBatch: m.points,
        items: [
          {
            sellerId: m.sellerId,
            sellerName: m.sellerName,
            previous: m.previous,
            points: m.points,
            total: m.total,
            type: m.type,
          },
        ],
      });
    }
  }

  return batches;
}

export function PublicSalesBoard({ initialSnapshot }: { initialSnapshot: SalesBoardSnapshot }) {
  const [preset, setPreset] = useState<DateFilterPreset>(initialSnapshot.dateFilter.preset);
  const [customStart, setCustomStart] = useState(initialSnapshot.dateFilter.startDate);
  const [customEnd, setCustomEnd] = useState(initialSnapshot.dateFilter.endDate);
  const [isTvMode, setIsTvMode] = useState(false);
  const [today, setToday] = useState(() => getSantoDomingoToday());
  const { snapshot, connectionStatus } = useSalesBoardRealtime({ initialSnapshot, preset, customStart, customEnd });
  const storeName = snapshot.settings.store_name || "YacellTech";
  const boardTitle = snapshot.settings.board_title || "Ranking de puntos";

  useEffect(() => {
    // TV mode also works when the built-in browser has no Fullscreen API.
    // Keep the server and initial client render identical, then read the device.
    const requestedMode = new URLSearchParams(window.location.search).get("tv");
    let savedTvMode: string | null = null;
    try { savedTvMode = window.localStorage.getItem("salesboard-tv"); } catch {}
    const smartTv = /SmartTV|Smart-TV|Tizen|Web0S|WebOS|HbbTV|Viera|BRAVIA|AFT\w+|Android.*TV|AndroidTV|GoogleTV|MiTV|TV\s?Bro|Silk|NetCast/i.test(navigator.userAgent);
    setIsTvMode(requestedMode === "1" || (requestedMode !== "0" && (savedTvMode === null ? smartTv : savedTvMode === "true")));
    const timer = window.setInterval(() => setToday(getSantoDomingoToday()), 30000);
    const fullscreenChange = () => {
      if (document.fullscreenElement) setIsTvMode(true);
    };
    document.addEventListener("fullscreenchange", fullscreenChange);
    return () => { window.clearInterval(timer); document.removeEventListener("fullscreenchange", fullscreenChange); };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const nextMode = !isTvMode;
    setIsTvMode(nextMode);
    try { window.localStorage.setItem("salesboard-tv", String(nextMode)); } catch {}
    try {
      if (!nextMode && document.fullscreenElement) await document.exitFullscreen();
      else if (nextMode && !document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    } catch { /* The TV layout remains active if fullscreen is unavailable. */ }
  }, [isTvMode]);

  return (
    <main className="public-board" data-tv={isTvMode}>
      <header className="board-header">
        <div className="board-wordmark"><YacellTechLogo className="board-brand-logo" />{storeName.toLowerCase() !== "yacelltech" && <div className="board-brand-copy"><small>{storeName}</small></div>}</div>
        <div className="board-header-right">
          <div className="board-date"><span>{formatLongDateSantoDomingo(today)}</span><small><span className="connection-dot" data-connected={connectionStatus === "connected"} />{connectionStatus === "reconnecting" ? "Reconectando…" : `Actualizado ${formatTimeSantoDomingo(snapshot.lastUpdatedIso)}`}</small></div>
          <div className="board-controls">
            {!isTvMode && <select className="period-select" aria-label="Período del tablero" value={preset} onChange={(event) => setPreset(event.target.value as DateFilterPreset)}><option value="today">Hoy</option><option value="yesterday">Ayer</option><option value="last7days">Últimos 7 días</option><option value="thisMonth">Este mes</option><option value="custom">Rango personalizado</option></select>}
            <ThemeToggle />
            <button type="button" className="icon-button" aria-label={isTvMode ? "Desactivar modo TV" : "Activar modo TV"} aria-pressed={isTvMode} onClick={toggleFullscreen} title={isTvMode ? "Desactivar modo TV" : "Activar modo TV"}>{isTvMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          </div>
        </div>
      </header>
      {preset === "custom" && !isTvMode && <div className="custom-range"><label>Desde <input type="date" aria-label="Fecha inicial" value={customStart} max={customEnd} onChange={(event) => { if (event.target.value) setCustomStart(event.target.value); }} /></label><label>Hasta <input type="date" aria-label="Fecha final" value={customEnd} min={customStart} onChange={(event) => { if (event.target.value) setCustomEnd(event.target.value); }} /></label></div>}
      <ManagerCard goalMonths={snapshot.goalMonths} manager={snapshot.manager} staticDisplay={isTvMode} />
      <VerticalSellersChart goalMonths={snapshot.goalMonths} prizeName={snapshot.settings.monthly_seller_prize_name} prizeValue={snapshot.settings.monthly_seller_prize_value} sellers={snapshot.rankedSellers} staticDisplay={isTvMode} title={preset === "today" ? boardTitle : `${boardTitle} · ${snapshot.dateFilter.label}`} />
      {!isTvMode && snapshot.movements && snapshot.movements.length > 0 && (
        <section className="mt-8 rounded-2xl border border-separator bg-surface p-6 shadow-subtle space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator/70 pb-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                <span>Historial de lo que puse antes ({snapshot.dateFilter.label})</span>
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                Detalle cronológico de las actualizaciones: cómo estaba antes ➔ cambio ➔ cómo quedó cada vendedor.
              </p>
            </div>
            <span className="text-xs font-semibold text-accent tabular-nums bg-accent/10 px-3 py-1 rounded-xl">
              {snapshot.movements.length} {snapshot.movements.length === 1 ? "cambio registrado" : "cambios registrados"}
            </span>
          </div>

          <div className="space-y-3">
            {groupPublicMovements(snapshot.movements).map((batch, bIdx) => (
              <div
                key={`${batch.appliedAt}-${bIdx}`}
                className="rounded-xl border border-separator bg-muted/40 p-4 text-xs space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{batch.shiftIcon}</span>
                    <strong className="text-foreground font-semibold">
                      {batch.shiftLabel} · {batch.timeStr}
                    </strong>
                    <span className="text-secondary text-[11px]">
                      ({formatShortDateEs(batch.date)})
                    </span>
                  </div>
                  <span className="font-bold text-accent tabular-nums text-sm">
                    {batch.totalPointsBatch >= 0 ? `+${batch.totalPointsBatch}` : batch.totalPointsBatch} pts
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {batch.items.map((item) => (
                    <div
                      key={item.sellerId}
                      className="rounded-lg border border-separator/60 bg-surface p-2.5 text-xs flex flex-col justify-between shadow-2xs"
                    >
                      <span className="font-semibold text-foreground truncate mb-1">
                        {item.sellerName}
                      </span>
                      <div className="text-[11px] text-secondary tabular-nums space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span>Antes:</span>
                          <strong className="text-foreground">{item.previous} pts</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Cambio:</span>
                          <strong className={item.points >= 0 ? "text-accent" : "text-rose-500"}>
                            {item.points >= 0 ? `+${item.points}` : item.points} pts
                          </strong>
                        </div>
                        <div className="flex items-center justify-between border-t border-separator/40 pt-0.5">
                          <span>Quedó:</span>
                          <strong className="text-foreground">{item.total} pts</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
