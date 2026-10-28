"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFirstDayOfMonth, getSantoDomingoToday } from "@/lib/date-utils";
import { pointsReportRangeSchema } from "@/lib/validations";
import type { PointsReport } from "@/types/points-report";

export function PointsReports() {
  const [today] = useState(getSantoDomingoToday);
  const [startDate, setStartDate] = useState(getFirstDayOfMonth(today));
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState<PointsReport | null>(null);
  const [busy, setBusy] = useState<"json" | "xlsx" | null>(null);
  const [error, setError] = useState("");
  const [exported, setExported] = useState(false);

  const generate = async (format: "json" | "xlsx") => {
    if (busy) return;
    setError(""); setExported(false);
    const parsed = pointsReportRangeSchema.safeParse({ startDate, endDate });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Rango inválido"); return; }
    setBusy(format);
    try {
      const response = await fetch(`/api/admin/reports?${new URLSearchParams({ startDate, endDate, format })}`, { cache: "no-store" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "No se pudo generar el reporte"); }
      if (format === "json") setReport(await response.json());
      else {
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url; link.download = `YacellTech-puntos-${startDate}-a-${endDate}.xlsx`;
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        setExported(true);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Error al consultar"); }
    finally { setBusy(null); }
  };

  return <section className="space-y-6" aria-label="Reportes de puntos">
    <div className="admin-page-heading"><div><h1>Reporte de puntos</h1><p>Consulta cuánto se aplicó cada día y descarga el detalle en Excel.</p></div></div>
    <div className="rounded-2xl border border-separator bg-surface p-5 space-y-4">
      <fieldset disabled={Boolean(busy)} className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2">Desde<input type="date" aria-label="Reporte desde" value={startDate} max={endDate} onInput={(event) => { setStartDate(event.currentTarget.value); setReport(null); setExported(false); }} onChange={(event) => { setStartDate(event.target.value); setReport(null); setExported(false); }} className="h-10 rounded-lg border border-separator bg-muted px-3" /></label>
        <label className="flex flex-col gap-2">Hasta<input type="date" aria-label="Reporte hasta" value={endDate} min={startDate} onInput={(event) => { setEndDate(event.currentTarget.value); setReport(null); setExported(false); }} onChange={(event) => { setEndDate(event.target.value); setReport(null); setExported(false); }} className="h-10 rounded-lg border border-separator bg-muted px-3" /></label>
        <Button type="button" variant="outline" onClick={() => void generate("json")} disabled={Boolean(busy)}>{busy === "json" && <RefreshCw className="h-4 w-4 animate-spin" />}Ver reporte</Button>
        <Button type="button" onClick={() => void generate("xlsx")} disabled={Boolean(busy)}>{busy === "xlsx" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Exportar Excel</Button>
      </fieldset>
      <p className="text-sm text-secondary">Ambas fechas incluidas · Hasta 366 días · Incluye vendedores inactivos y ocultos en TV.</p>
      {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
      {exported && <p role="status" className="text-sm text-success-text">Excel generado. Revisa las descargas del navegador.</p>}
    </div>
    {report && <>
      <div className="rounded-2xl border border-separator bg-surface p-5"><p className="text-sm text-secondary">Total del {report.startDate} al {report.endDate}</p><p className="text-4xl font-semibold tabular-nums mt-2">{report.total.toLocaleString("es-DO")} puntos</p>
        <p className="text-sm text-secondary mt-3">{report.movements.length} aplicaciones o correcciones disponibles en auditoría. Los registros anteriores pueden no tener el desglose de cada aplicación.</p>
      </div>
      <div className="rounded-2xl border border-separator bg-surface overflow-hidden">
        <div className="p-5"><h2 className="text-lg">Puntos por día y vendedor</h2><p className="text-xs text-secondary mt-1">— significa sin registro; 0 es un registro guardado con cero puntos.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-muted"><tr><th className="p-3">Fecha</th>{report.sellers.map((seller) => <th className="p-3" key={seller.id}>{seller.name}{!seller.active && <small className="block font-normal">Inactivo</small>}</th>)}<th className="p-3">Total</th></tr></thead>
          <tbody>{report.days.map((day) => <tr key={day.date} className="border-t border-separator"><td className="p-3 whitespace-nowrap">{day.date}</td>{report.sellers.map((seller) => <td className="p-3 tabular-nums" key={seller.id}>{day.points[seller.id]?.toLocaleString("es-DO") ?? "—"}</td>)}<td className="p-3 font-semibold tabular-nums">{day.total.toLocaleString("es-DO")}</td></tr>)}</tbody>
          <tfoot className="bg-muted font-semibold"><tr><th className="p-3">Total</th>{report.sellers.map((seller) => <td className="p-3 tabular-nums" key={seller.id}>{seller.total.toLocaleString("es-DO")}</td>)}<td className="p-3 tabular-nums">{report.total.toLocaleString("es-DO")}</td></tr></tfoot>
        </table></div>
      </div>
    </>}
  </section>;
}
