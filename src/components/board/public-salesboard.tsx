"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { DateFilterPreset, SalesBoardSnapshot } from "@/types/salesboard";
import { useSalesBoardRealtime } from "@/hooks/use-salesboard-realtime";
import { formatLongDateSantoDomingo, formatTimeSantoDomingo, getSantoDomingoToday } from "@/lib/date-utils";
import { ManagerCard } from "@/components/board/manager-card";
import { VerticalSellersChart } from "@/components/board/vertical-sellers-chart";
import { ThemeToggle } from "@/components/ui/appearance-provider";
import { YacellTechLogo } from "@/components/ui/yacelltech-logo";

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
    const smartTv = /SmartTV|Smart-TV|Tizen|Web0S|WebOS|HbbTV|Viera|BRAVIA|AFT\w+|Android.*TV/i.test(navigator.userAgent);
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
      <VerticalSellersChart goalMonths={snapshot.goalMonths} sellers={snapshot.rankedSellers} staticDisplay={isTvMode} title={preset === "today" ? boardTitle : `${boardTitle} · ${snapshot.dateFilter.label}`} />
    </main>
  );
}
