"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { Button } from "@/components/ui/button";
import { broadcastBoardUpdate } from "@/hooks/use-salesboard-realtime";
import type { Seller } from "@/types/salesboard";

const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function WeeklyDaysOff({ sellers }: { sellers: Seller[] }) {
  const [daysOff, setDaysOff] = useState<Record<string, number | null> | null>(null);
  const [today, setToday] = useState("");
  const [todayOff, setTodayOff] = useState<Record<string, boolean>>({});
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadDaysOff() {
      try {
        const response = await fetch("/api/admin/days-off", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setDaysOff(data.daysOff); setToday(data.today); setTodayOff(data.todayOff); }
      } catch {
        if (!controller.signal.aborted) setError("No se pudieron cargar los días libres.");
      }
    }
    void loadDaysOff();
    return () => controller.abort();
  }, [loadAttempt]);

  async function saveDay(seller: Seller, weekday: number | null) {
    setSavingId(seller.id);
    setConfirmation("");
    setError("");
    try {
      const response = await fetch("/api/admin/days-off", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_id: seller.id, weekday }),
      });
      if (!response.ok) throw new Error();
      broadcastBoardUpdate();
      setLoadAttempt((attempt) => attempt + 1);
      setDaysOff((previous) => ({ ...previous, [seller.id]: weekday }));
      setConfirmation(weekday === null
        ? `Se quitó el día libre de ${seller.full_name}.`
        : `Día libre de ${seller.full_name} guardado.`);
    } catch {
      setError(`No se pudo guardar el día libre de ${seller.full_name}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function setTodayStatus(seller: Seller, isOff: boolean) {
    setSavingId(seller.id); setError(""); setConfirmation("");
    try {
      const response = await fetch("/api/admin/days-off", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seller_id: seller.id, is_off: isOff, date: today }) });
      if (!response.ok) throw new Error();
      setTodayOff(previous => ({ ...previous, [seller.id]: isOff }));
      setConfirmation(`${seller.full_name}: ${isOff ? "día libre" : "trabajando"} hoy.`);
      broadcastBoardUpdate();
    } catch { setError("No se pudo actualizar el estado de hoy. Recarga y vuelve a intentar."); }
    finally { setSavingId(null); }
  }

  const activeSellers = sellers.filter((seller) => seller.is_active);

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-separator bg-surface shadow-subtle">
      <header className="flex items-start gap-3 border-b border-separator px-5 py-4 sm:px-6">
        <CalendarDays size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        <div>
          <h2 className="font-display text-lg font-medium text-foreground">Días libres</h2>
          <p className="text-sm text-secondary">Configura el día semanal o marca una excepción solo para hoy. Es un indicador; no modifica puntos.</p>
        </div>
      </header>
      {daysOff ? (
        activeSellers.length > 0 ? (
          <ul className="divide-y divide-separator">
            {activeSellers.map((seller) => (
              <li key={seller.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <label htmlFor={`day-off-${seller.id}`} className="flex items-center gap-3 text-sm font-medium">
                  <AvatarBadge src={seller.avatar_url} name={seller.full_name} size="sm" />
                  {seller.full_name}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!todayOff[seller.id]} disabled={savingId !== null || !today} onChange={(event) => void setTodayStatus(seller, event.target.checked)} /> Libre hoy</label>
                <select
                  id={`day-off-${seller.id}`}
                  aria-label={`Día libre de ${seller.full_name}`}
                  value={daysOff[seller.id] ?? ""}
                  disabled={savingId !== null}
                  onChange={(event) => void saveDay(seller, event.target.value ? Number(event.target.value) : null)}
                  className="h-10 min-w-36 rounded-[10px] border border-separator bg-muted px-3 text-sm text-foreground disabled:opacity-60"
                >
                  <option value="">Sin asignar</option>
                  {weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
                </select>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-4 text-sm text-secondary">No hay vendedores activos.</p>
      ) : error ? (
        <div className="px-5 pt-4">
          <Button type="button" variant="outline" onClick={() => {
            setError("");
            setLoadAttempt((attempt) => attempt + 1);
          }}>Volver a cargar</Button>
        </div>
      ) : <p role="status" className="px-5 py-4 text-sm text-secondary">Cargando días libres…</p>}
      {error && <p role="alert" className="px-5 py-4 text-sm text-danger-text">{error}</p>}
      {(savingId || confirmation) && (
        <p role="status" className="border-t border-separator px-5 py-3 text-sm text-secondary">
          {savingId ? "Guardando día libre…" : confirmation}
        </p>
      )}
    </section>
  );
}
