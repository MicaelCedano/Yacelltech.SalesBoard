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
  const [preset, setPreset] = useState<DateFilterPreset>("today");
  const [customStart, setCustomStart] = useState(initialSnapshot.dateFilter.startDate);
  const [customEnd, setCustomEnd] = useState(initialSnapshot.dateFilter.endDate);
  const [isTvMode, setIsTvMode] = useState(false);
  const [today, setToday] = useState(() => getSantoDomingoToday());
  const { snapshot, connectionStatus } = useSalesBoardRealtime({ initialSnapshot, preset, customStart, customEnd });
  const storeName = snapshot.settings.store_name || "YacellTech";
  const boardTitle = snapshot.settings.board_title || "Ranking de puntos";

  useEffect(() => {
    const timer = window.setInterval(() => setToday(getSantoDomingoToday()), 30000);
    const fullscreenChange = () => setIsTvMode(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", fullscreenChange);
    return () => { window.clearInterval(timer); document.removeEventListener("fullscreenchange", fullscreenChange); };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setIsTvMode((previous) => !previous); }
  }, []);

  return (
    <main className="public-board" data-tv={isTvMode}>
      <header className="board-header">
        <div className="board-wordmark"><YacellTechLogo className="board-brand-logo" />{storeName.toLowerCase() !== "yacelltech" && <div className="board-brand-copy"><small>{storeName}</small></div>}</div>
        <div className="board-header-right">
          <div className="board-date"><span>{formatLongDateSantoDomingo(today)}</span><small><span className="connection-dot" data-connected={connectionStatus === "connected"} />{connectionStatus === "reconnecting" ? "Reconectando…" : `Actualizado ${formatTimeSantoDomingo(snapshot.lastUpdatedIso)}`}</small></div>
          <div className="board-controls">
            {!isTvMode && <select className="period-select" aria-label="Período del tablero" value={preset} onChange={(event) => setPreset(event.target.value as DateFilterPreset)}><option value="today">Hoy</option><option value="yesterday">Ayer</option><option value="last7days">Últimos 7 días</option><option value="thisMonth">Este mes</option><option value="custom">Rango personalizado</option></select>}
            <ThemeToggle />
            <button type="button" className="icon-button" aria-label={isTvMode ? "Salir de pantalla completa" : "Activar modo TV"} onClick={toggleFullscreen} title={isTvMode ? "Salir de pantalla completa" : "Activar modo TV"}>{isTvMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          </div>
        </div>
      </header>
      {preset === "custom" && !isTvMode && <div className="custom-range"><label>Desde <input type="date" aria-label="Fecha inicial" value={customStart} max={customEnd} onChange={(event) => { if (event.target.value) setCustomStart(event.target.value); }} /></label><label>Hasta <input type="date" aria-label="Fecha final" value={customEnd} min={customStart} onChange={(event) => { if (event.target.value) setCustomEnd(event.target.value); }} /></label></div>}
      <ManagerCard manager={snapshot.manager} />
      <VerticalSellersChart sellers={snapshot.rankedSellers} title={preset === "today" ? boardTitle : `${boardTitle} · ${snapshot.dateFilter.label}`} />
    </main>
  );
}
