"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, BarChart3, CheckCircle2, Database, ExternalLink, Eye, EyeOff, LogOut, Plus, Pencil, RefreshCw, RotateCcw, Save, Sparkles, UserCheck, UserPlus } from "lucide-react";
import {
  AuditLogEntry,
  DateFilterPreset,
  SalesBoardSnapshot,
  Seller,
} from "@/types/salesboard";
import {
  addDaysToDateString,
  formatLongDateSantoDomingo,
  formatShortDateEs,
  formatTimeSantoDomingo,
  getSantoDomingoToday,
} from "@/lib/date-utils";
import { broadcastBoardUpdate } from "@/hooks/use-salesboard-realtime";
import { ThemeToggle } from "@/components/ui/appearance-provider";
import { YacellTechLogo } from "@/components/ui/yacelltech-logo";
import { SellerPhotoField } from "@/components/admin/seller-photo-field";
import { PointsReports } from "@/components/admin/points-reports";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AdminDashboardProps {
  initialSnapshot: SalesBoardSnapshot;
  adminEmail: string;
  mode: "supabase" | "demo-local";
  onLogout: () => void;
}

type AdminTab = "daily" | "reports" | "sellers" | "goals" | "manager" | "audit";

interface EditableDailyRow {
  seller_id: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  show_on_board: boolean;
  units_sold: number | "";
  points_to_add: number | "";
  expected_version: number;
}

export function AdminDashboard({
  initialSnapshot,
  adminEmail,
  mode,
  onLogout,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("daily");
  const [snapshot, setSnapshot] = useState<SalesBoardSnapshot>(initialSnapshot);

  // Fecha de registro diario seleccionada (Por defecto Hoy en America/Santo_Domingo)
  const todaySantoDomingo = useMemo(() => getSantoDomingoToday(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todaySantoDomingo);

  // Estado editable de la tabla diaria (Sección 7.1)
  const [rows, setRows] = useState<EditableDailyRow[]>([]);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [isSavingDaily, setIsSavingDaily] = useState(false);
  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [showCloseMonthConfirm, setShowCloseMonthConfirm] = useState(false);
  const [monthSnapshot, setMonthSnapshot] = useState<SalesBoardSnapshot>(initialSnapshot);
  const [dailyMode, setDailyMode] = useState<"add" | "set">("add");
  const [loadedDailyDate, setLoadedDailyDate] = useState<string | null>(null);
  const [dailyRetryPending, setDailyRetryPending] = useState(false);
  const dailySaveRef = useRef(false);
  const dailyLoadRef = useRef(0);
  const dailyRequestRef = useRef<{ request_id: string; mode: "add" | "set"; sale_date: string; entries: { seller_id: string; units_sold: number; expected_version: number }[] } | null>(null);

  // Filtro de consulta histórica (Sección 8)
  const [historyPreset, setHistoryPreset] = useState<DateFilterPreset>("today");
  const [historyCustomStart, setHistoryCustomStart] =
    useState<string>(todaySantoDomingo);
  const [historyCustomEnd, setHistoryCustomEnd] =
    useState<string>(todaySantoDomingo);
  const [historySnapshot, setHistorySnapshot] =
    useState<SalesBoardSnapshot>(initialSnapshot);

  // Estado de Gestión de Vendedores (Sección 7.2)
  const sellerFormRef = useRef<HTMLFormElement>(null);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [sellerName, setSellerName] = useState("");
  const [sellerAvatarUrl, setSellerAvatarUrl] = useState("");
  const [sellerOrder, setSellerOrder] = useState(1);
  const [sellerActive, setSellerActive] = useState(true);
  const [sellerShowOnBoard, setSellerShowOnBoard] = useState(true);
  const [isSavingSeller, setIsSavingSeller] = useState(false);
  const [isUploadingSellerPhoto, setIsUploadingSellerPhoto] = useState(false);

  // Estado del Manager General (Sección 7.3)
  const [managerName, setManagerName] = useState(
    initialSnapshot.settings.manager_name
  );
  const [managerLabel, setManagerLabel] = useState(
    initialSnapshot.settings.manager_label
  );
  const [managerAvatarUrl, setManagerAvatarUrl] = useState(
    initialSnapshot.settings.manager_avatar_url ?? ""
  );
  const [defaultMonthlySellerGoal, setDefaultMonthlySellerGoal] = useState<number | "">(
    initialSnapshot.settings.default_monthly_seller_goal ?? 400
  );
  const [defaultMonthlyManagerGoal, setDefaultMonthlyManagerGoal] = useState<number | "">(
    initialSnapshot.settings.default_monthly_manager_goal ?? 1000
  );
  const [monthlySellerPrizeName, setMonthlySellerPrizeName] = useState(
    initialSnapshot.settings.monthly_seller_prize_name ?? ""
  );
  const [monthlySellerPrizeValue, setMonthlySellerPrizeValue] = useState<number | "">(
    (initialSnapshot.settings.monthly_seller_prize_value ?? 0) > 0
      ? (initialSnapshot.settings.monthly_seller_prize_value ?? 0)
      : ""
  );
  const [storeName, setStoreName] = useState(
    initialSnapshot.settings.store_name
  );
  const [boardTitle, setBoardTitle] = useState(
    initialSnapshot.settings.board_title
  );
  const [isSavingManager, setIsSavingManager] = useState(false);
  const [isUploadingManagerPhoto, setIsUploadingManagerPhoto] = useState(false);

  // Historial de Auditoría (Sección 10 / 12)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Notificaciones de estado
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
      window.setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 5000);
    },
    []
  );

  // Sincronizar filas editables a partir de un snapshot de fecha única
  const syncRowsFromSnapshot = useCallback((snap: SalesBoardSnapshot) => {
    const sorted = [...snap.allSellersAdminTable].sort((a, b) => {
      if (a.seller.is_active !== b.seller.is_active) {
        return a.seller.is_active ? -1 : 1;
      }
      if (a.seller.display_order !== b.seller.display_order) {
        return a.seller.display_order - b.seller.display_order;
      }
      return a.seller.full_name.localeCompare(b.seller.full_name, "es");
    });

    setRows(
      sorted.map((item) => ({
        seller_id: item.seller.id,
        full_name: item.seller.full_name,
        avatar_url: item.seller.avatar_url,
        is_active: item.seller.is_active,
        show_on_board: item.seller.show_on_board,
        units_sold: item.unitsSold,
        points_to_add: 0,
        expected_version: item.recordVersion,
      }))
    );
  }, []);

  const loadMonthSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/board?preset=thisMonth", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as SalesBoardSnapshot;
      setMonthSnapshot(data);
    } catch {
      // Ignorar errores transitorios
    }
  }, []);

  // Cargar datos para la fecha seleccionada en Registro Diario
  const loadDailyData = useCallback(
    async (dateStr: string) => {
      const loadId = ++dailyLoadRef.current;
      setIsLoadingDate(true);
      setLoadedDailyDate(null);
      try {
        const res = await fetch(
          `/api/board?preset=custom&startDate=${dateStr}&endDate=${dateStr}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("No se pudo cargar la fecha seleccionada");
        const data = (await res.json()) as SalesBoardSnapshot;
        if (loadId !== dailyLoadRef.current) return;
        setSnapshot(data);
        syncRowsFromSnapshot(data);
        setLoadedDailyDate(dateStr);
        void loadMonthSnapshot();
      } catch (err) {
        if (loadId !== dailyLoadRef.current) return;
        showNotification(
          "error",
          err instanceof Error ? err.message : "Error al consultar fecha"
        );
      } finally {
        if (loadId === dailyLoadRef.current) setIsLoadingDate(false);
      }
    },
    [showNotification, syncRowsFromSnapshot, loadMonthSnapshot]
  );

  useEffect(() => {
    void loadDailyData(selectedDate);
  }, [selectedDate, loadDailyData]);

  // Cargar resumen del filtro histórico cuando cambia
  const loadHistoryRange = useCallback(async () => {
    try {
      const params = new URLSearchParams({ preset: historyPreset });
      if (historyPreset === "custom") {
        params.set("startDate", historyCustomStart);
        params.set("endDate", historyCustomEnd);
      }
      const res = await fetch(`/api/board?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as SalesBoardSnapshot;
      setHistorySnapshot(data);
    } catch {
      // Ignorar errores transitorios
    }
  }, [historyPreset, historyCustomStart, historyCustomEnd]);

  useEffect(() => {
    void loadHistoryRange();
  }, [loadHistoryRange]);

  const loadAuditHistory = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch("/api/admin/audit", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAuditLogs(data.logs ?? []);
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "audit") {
      void loadAuditHistory();
    }
  }, [activeTab, loadAuditHistory]);

  // Cálculo automático en vivo del total del Manager mientras el admin edita la tabla
  const liveManagerTotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.units_sold) || 0) + (dailyMode === "add" ? Number(r.points_to_add) || 0 : 0), 0);
  }, [rows, dailyMode]);

  const monthlySellerGoal = snapshot.settings.default_monthly_seller_goal ?? 400;
  const draftAppliesToMonth = selectedDate >= monthSnapshot.dateFilter.startDate && selectedDate <= monthSnapshot.dateFilter.endDate;
  const storedDailyTotal = snapshot.manager.totalUnitsSold;
  const liveMonthlyTotal = monthSnapshot.manager.totalUnitsSold + (draftAppliesToMonth ? liveManagerTotal - storedDailyTotal : 0);

  const monthUnitsBySeller = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of monthSnapshot.allSellersAdminTable) {
      map.set(item.seller.id, item.unitsSold);
    }
    return map;
  }, [monthSnapshot]);

  // Guardar estadísticas diarias (Operación atómica de múltiples vendedores)
  const handleSaveDailyStats = async () => {
    if (dailySaveRef.current || loadedDailyDate !== selectedDate || isLoadingDate) return;
    dailySaveRef.current = true;
    setIsSavingDaily(true);
    try {
      const payload = dailyRequestRef.current ?? {
        request_id: crypto.randomUUID(),
        mode: dailyMode,
        sale_date: selectedDate,
        entries: rows.map((r) => ({
          seller_id: r.seller_id,
          units_sold: Number(dailyMode === "add" ? r.points_to_add : r.units_sold),
          expected_version: r.expected_version,
        })),
      };
      if (!payload.entries.every((entry) => Number.isInteger(entry.units_sold) && entry.units_sold >= 0 && entry.units_sold <= 100000)) {
        throw new Error("Introduce puntos enteros entre 0 y 100000.");
      }
      dailyRequestRef.current = payload;

      const res = await fetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status < 500) { dailyRequestRef.current = null; setDailyRetryPending(false); }
        throw new Error(data.error ?? "Error al guardar las estadísticas");
      }

      dailyRequestRef.current = null;
      setDailyRetryPending(false);
      const nextSnapshot = data.snapshot as SalesBoardSnapshot;
      setSnapshot(nextSnapshot);
      syncRowsFromSnapshot(nextSnapshot);
      void loadMonthSnapshot();
      void loadHistoryRange();
      broadcastBoardUpdate();

      showNotification(
        "success",
        `${payload.mode === "add" ? "Puntos sumados" : "Totales corregidos"} para el ${formatShortDateEs(payload.sale_date)} y publicados en tiempo real.`
      );
    } catch (err) {
      if (dailyRequestRef.current) setDailyRetryPending(true);
      showNotification(
        "error",
        err instanceof Error ? err.message : "Error al guardar estadísticas"
      );
    } finally {
      dailySaveRef.current = false;
      setIsSavingDaily(false);
    }
  };

  // Cerrar mes y reiniciar la pantalla pública y el contador actual a 0 (conservando el historial diario)
  const handleCloseMonthAndResetBoard = async () => {
    if (isClosingMonth || isSavingDaily) return;
    setIsClosingMonth(true);
    try {
      const res = await fetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          mode: "close_month",
          sale_date: todaySantoDomingo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo cerrar el mes y reiniciar la pantalla");
      }

      setShowCloseMonthConfirm(false);
      setDailyMode("add");
      setSelectedDate(todaySantoDomingo);
      const nextSnapshot = data.snapshot as SalesBoardSnapshot;
      setSnapshot(nextSnapshot);
      syncRowsFromSnapshot(nextSnapshot);
      setLoadedDailyDate(todaySantoDomingo);
      if (data.monthSnapshot) {
        setMonthSnapshot(data.monthSnapshot as SalesBoardSnapshot);
      } else {
        void loadMonthSnapshot();
      }
      void loadHistoryRange();
      void loadAuditHistory();
      broadcastBoardUpdate();

      showNotification(
        "success",
        `Mes cerrado (${Number(data.closedTotal ?? 0).toLocaleString("es-DO")} puntos guardados en el historial). La pantalla se reinició a 0 para empezar a sumar el nuevo mes.`
      );
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Error al cerrar el mes"
      );
    } finally {
      setIsClosingMonth(false);
    }
  };

  // Subida de fotografía a Supabase Storage (o Data URL en modo demo)
  const uploadPhotoFile = async (
    file: File,
    onUrlReady: (url: string) => void,
    setUploading: (val: boolean) => void
  ) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      showNotification("error", "Formato no permitido. Usa JPG, PNG, WebP o AVIF.");
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      showNotification("error", "Selecciona una fotografía de entre 1 byte y 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo subir la fotografía");
      }
      onUrlReady(data.url);
      showNotification("success", "Fotografía lista. Guarda los cambios para publicarla.");
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Error al subir imagen"
      );
    } finally {
      setUploading(false);
    }
  };

  // Preparar formulario para editar vendedor
  const startEditSeller = (seller: Seller) => {
    setEditingSellerId(seller.id);
    setSellerName(seller.full_name);
    setSellerAvatarUrl(seller.avatar_url ?? "");
    setSellerOrder(seller.display_order);
    setSellerActive(seller.is_active);
    setSellerShowOnBoard(seller.show_on_board);
    sellerFormRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    sellerFormRef.current?.querySelector<HTMLInputElement>("#seller-name")?.focus({ preventScroll: true });
  };

  const resetSellerForm = () => {
    setEditingSellerId(null);
    setSellerName("");
    setSellerAvatarUrl("");
    setSellerOrder(rows.length + 1);
    setSellerActive(true);
    setSellerShowOnBoard(true);
  };

  const handleSaveSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploadingSellerPhoto || isSavingSeller) return;
    setIsSavingSeller(true);
    try {
      const isEditing = Boolean(editingSellerId);
      const res = await fetch("/api/admin/sellers", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing ? { id: editingSellerId } : { bar_color: "#007AFF" }),
          full_name: sellerName.trim(),
          avatar_url: sellerAvatarUrl.trim() ? sellerAvatarUrl.trim() : null,
          display_order: Math.max(0, Math.floor(Number(sellerOrder) || 0)),
          is_active: sellerActive,
          show_on_board: sellerShowOnBoard,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo guardar el vendedor");
      }

      resetSellerForm();
      await loadDailyData(selectedDate);
      void loadHistoryRange();
      broadcastBoardUpdate();
      showNotification(
        "success",
        isEditing
          ? "Vendedor actualizado correctamente."
          : "Nuevo vendedor añadido al tablero."
      );
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Error al guardar vendedor"
      );
    } finally {
      setIsSavingSeller(false);
    }
  };

  const handleToggleSellerProperty = async (
    seller: Seller,
    field: "is_active" | "show_on_board"
  ) => {
    try {
      const res = await fetch("/api/admin/sellers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: seller.id,
          [field]: !seller[field],
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? "No se pudo actualizar el estado");
      }
      await loadDailyData(selectedDate);
      void loadHistoryRange();
      broadcastBoardUpdate();
      showNotification(
        "success",
        `Configuración de ${seller.full_name} actualizada.`
      );
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Error al actualizar vendedor"
      );
    }
  };

  const handleSaveManagerSettings = async (e: React.FormEvent, scope: "manager" | "goals" = "manager") => {
    e.preventDefault();
    if (isUploadingManagerPhoto || isSavingManager) return;
    setIsSavingManager(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scope === "goals" ? {
          ...snapshot.settings,
          default_monthly_seller_goal: Number(defaultMonthlySellerGoal) || 0,
          default_monthly_manager_goal: Number(defaultMonthlyManagerGoal) || 0,
          monthly_seller_prize_name: monthlySellerPrizeName.trim(),
          monthly_seller_prize_value: Number(monthlySellerPrizeValue) || 0,
          expected_version: snapshot.settings.version,
        } : {
          store_name: storeName.trim() || "YACELLTECH",
          board_title: boardTitle.trim() || "Ranking de puntos",
          manager_name: managerName.trim(),
          manager_label: managerLabel.trim() || "MANAGER GENERAL",
          manager_avatar_url: managerAvatarUrl.trim()
            ? managerAvatarUrl.trim()
            : null,
          default_monthly_seller_goal: snapshot.settings.default_monthly_seller_goal ?? 400,
          default_monthly_manager_goal: snapshot.settings.default_monthly_manager_goal ?? 1000,
          monthly_seller_prize_name: snapshot.settings.monthly_seller_prize_name ?? "",
          monthly_seller_prize_value: snapshot.settings.monthly_seller_prize_value ?? 0,
          expected_version: snapshot.settings.version,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo guardar la configuración");
      }

      await loadDailyData(selectedDate);
      void loadHistoryRange();
      broadcastBoardUpdate();
      showNotification(
        "success",
        scope === "goals" ? "Metas mensuales actualizadas y publicadas." : "Configuración del Manager General actualizada y publicada."
      );
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Error al actualizar Manager"
      );
    } finally {
      setIsSavingManager(false);
    }
  };

  const handleInitializeDemo = async (
    preset: "daily_34_of_50" | "high_volume_350"
  ) => {
    try {
      const res = await fetch("/api/admin/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo inicializar la demostración");
      }
      setSelectedDate(todaySantoDomingo);
      await loadDailyData(todaySantoDomingo);
      void loadHistoryRange();
      void loadAuditHistory();
      broadcastBoardUpdate();
      showNotification(
        "success",
        "Datos de demostración (5 vendedores: Luis, José, Carlos, Ana y María) cargados correctamente."
      );
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Error al cargar demostración"
      );
    }
  };

  return (
    <div className="admin-shell">
      {toast && (
        <div role={toast.type === "error" ? "alert" : "status"} className="admin-toast">
          {toast.type === "success" ? <CheckCircle2 size={18} className="text-success-text" /> : <AlertCircle size={18} className="text-danger-text" />}
          <span>{toast.message}</span>
        </div>
      )}
      <header className="admin-header">
        <div className="admin-topbar">
          <div className="admin-brand"><div className="admin-product-brand"><YacellTechLogo className="admin-brand-logo" /><strong>SalesBoard</strong></div><span>Administración{mode === "demo-local" ? " · Demo local" : ""}</span></div>
          <div className="admin-actions">
            <span className="admin-email">{adminEmail}</span>
            <ThemeToggle />
            <Link href="/" target="_blank" className="inline-flex items-center gap-2 rounded-[10px] border border-separator px-4 py-2 text-sm text-accent">Ver tablero <ExternalLink size={14} /></Link>
            <button type="button" className="icon-button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={18} /></button>
          </div>
        </div>
        <nav className="admin-nav" aria-label="Secciones administrativas">
          {([
            ["daily", "Registro diario"], ["reports", "Reportes / Excel"], ["sellers", "Vendedores"], ["goals", "Metas"], ["manager", "Manager General"], ["audit", "Historial"],
          ] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={activeTab === id ? "page" : undefined}>{label}</button>)}
        </nav>
      </header>
      <main className="admin-main space-y-6">
        {activeTab === "reports" && <PointsReports />}
        {activeTab === "goals" && (
          <section className="mx-auto max-w-3xl rounded-2xl border border-separator bg-surface p-6 space-y-5">
            <div><h1 className="font-display text-xl font-semibold">Metas</h1><p className="mt-2 text-sm text-secondary">Configura las metas mensuales de los vendedores y del supervisor. Cada objetivo es independiente.</p></div>
            <form onSubmit={(event) => void handleSaveManagerSettings(event, "goals")}>
              <fieldset disabled={isSavingManager} className="space-y-5 min-w-0">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="rounded-xl border border-separator bg-muted p-4">
                    <label htmlFor="monthly-seller-goal" className="mb-2 block text-sm font-semibold">Meta mensual por vendedor (Puntos)</label>
                    <Input id="monthly-seller-goal" aria-label="Meta mensual por vendedor" type="number" min={0} max={100000} step={1} required value={defaultMonthlySellerGoal} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDefaultMonthlySellerGoal(event.target.value === "" ? "" : Number(event.target.value))} />
                    <p className="mt-2 text-xs text-secondary">La misma meta se aplica a cada vendedor, con sus propios puntos acumulados durante el mes.</p>
                  </div>
                  <div className="rounded-xl border border-separator bg-muted p-4">
                    <label htmlFor="monthly-manager-goal" className="mb-2 block text-sm font-semibold">Meta mensual del supervisor (Puntos)</label>
                    <Input id="monthly-manager-goal" aria-label="Meta mensual del supervisor" type="number" min={0} max={100000} step={1} required value={defaultMonthlyManagerGoal} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDefaultMonthlyManagerGoal(event.target.value === "" ? "" : Number(event.target.value))} />
                    <p className="mt-2 text-xs text-secondary">Objetivo del Manager General. Suma los puntos de todos los vendedores para alcanzar esta meta.</p>
                  </div>
                </div>
                <div className="rounded-xl border border-separator bg-muted p-4 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Premio de la meta mensual de vendedores</h2>
                    <p className="mt-1 text-xs text-secondary">Se muestra en una franja destacada dentro del ranking público (justo debajo del título) con el nombre del premio, su valor en RD$ y los puntos necesarios. Déjalo en blanco si no deseas mostrar premio.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="monthly-seller-prize-name" className="mb-2 block text-sm font-semibold">Premio en texto</label>
                      <Input id="monthly-seller-prize-name" aria-label="Premio en texto" type="text" maxLength={120} placeholder="Ej. Bono en efectivo, Smart TV, Fin de semana..." value={monthlySellerPrizeName} onChange={(event) => setMonthlySellerPrizeName(event.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="monthly-seller-prize-value" className="mb-2 block text-sm font-semibold">Precio / Valor del premio (RD$)</label>
                      <Input id="monthly-seller-prize-value" aria-label="Valor del premio en RD$" type="number" min={0} max={100000000} step={1} placeholder="Ej. 5000" value={monthlySellerPrizeValue} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setMonthlySellerPrizeValue(event.target.value === "" ? "" : Number(event.target.value))} />
                    </div>
                  </div>
                </div>
                <Button type="submit">{isSavingManager ? "Guardando..." : "Guardar metas"}</Button>
              </fieldset>
            </form>
          </section>
        )}
        {/* ===================================================================
            PESTAÑA 1: REGISTRO DIARIO DE PUNTOS Y CONSULTA POR FECHAS
           =================================================================== */}
        {activeTab === "daily" && (
          <div className="space-y-6">
            <div className="admin-page-heading">
              <div><h1>Registro diario</h1><p>{dailyMode === "add" ? "Introduce los puntos nuevos; se sumarán a los ya registrados para esa fecha." : "Corrige el total del día. Este modo reemplaza la cantidad guardada."}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" disabled={isSavingDaily || dailyRetryPending} aria-label="Seleccionar fecha a editar" value={selectedDate} max={todaySantoDomingo} onInput={(event) => { if (event.currentTarget.value) setSelectedDate(event.currentTarget.value); }} onChange={(event) => { if (event.target.value) setSelectedDate(event.target.value); }} className="h-10 rounded-[10px] border border-separator bg-surface px-3 text-sm" />
                <Button size="sm" disabled={isSavingDaily || dailyRetryPending} variant={selectedDate === todaySantoDomingo ? "default" : "outline"} onClick={() => setSelectedDate(todaySantoDomingo)}>Hoy</Button>
                <Button size="sm" disabled={isSavingDaily || dailyRetryPending} variant={selectedDate === addDaysToDateString(todaySantoDomingo, -1) ? "default" : "outline"} onClick={() => setSelectedDate(addDaysToDateString(todaySantoDomingo, -1))}>Ayer</Button>
                <Button size="sm" variant="outline" disabled={isSavingDaily || isLoadingDate || dailyRetryPending} onClick={() => void loadDailyData(selectedDate)}>Recargar fecha</Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2" role="group" aria-label="Operación de puntos">
              <div className="flex flex-wrap gap-2">
                <Button variant={dailyMode === "add" ? "default" : "outline"} disabled={isSavingDaily || isClosingMonth || dailyRetryPending || isLoadingDate} onClick={() => { setDailyMode("add"); syncRowsFromSnapshot(snapshot); }}>Sumar puntos</Button>
                <Button variant={dailyMode === "set" ? "default" : "outline"} disabled={isSavingDaily || isClosingMonth || dailyRetryPending || isLoadingDate} onClick={() => { setDailyMode("set"); syncRowsFromSnapshot(snapshot); }}>Corregir total del día</Button>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isSavingDaily || isClosingMonth || dailyRetryPending || isLoadingDate}
                onClick={() => setShowCloseMonthConfirm((prev) => !prev)}
                className="border-warning-text/40 text-foreground hover:bg-warning-soft"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Cerrar mes / Reiniciar pantalla</span>
              </Button>
            </div>
            {showCloseMonthConfirm && (
              <div role="region" aria-label="Confirmar cierre de mes" className="rounded-2xl border border-separator bg-surface p-5 space-y-4 shadow-subtle">
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    ¿Cerrar el mes y reiniciar la pantalla a 0?
                  </h3>
                  <p className="text-xs text-secondary mt-1">
                    Usa esta opción cuando se le pagan los puntos del mes a los vendedores. La pantalla pública (TV) y el contador actual volverán a <strong>0 puntos</strong> para empezar a sumar el nuevo mes, pero <strong>todo el historial de cuánto se dio cada día a cada persona se conserva completo</strong> en Historial y en Exportar Excel.
                  </p>
                </div>
                <div className="rounded-xl border border-separator bg-muted p-3.5 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-secondary">
                      Puntos acumulados del mes actual ({monthSnapshot.dateFilter.label}):
                    </span>
                    <strong className="text-sm text-foreground tabular-nums">
                      {monthSnapshot.manager.totalUnitsSold.toLocaleString("es-DO")} puntos
                    </strong>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {monthSnapshot.allSellersAdminTable.map((item) => (
                      <span
                        key={item.seller.id}
                        className="rounded-lg border border-separator bg-surface px-2.5 py-1 tabular-nums"
                      >
                        {item.seller.full_name}: <strong>{item.unitsSold.toLocaleString("es-DO")} pts</strong>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isClosingMonth}
                    onClick={() => setShowCloseMonthConfirm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    disabled={isClosingMonth}
                    onClick={() => void handleCloseMonthAndResetBoard()}
                  >
                    {isClosingMonth ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Cerrando mes...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4" />
                        <span>Confirmar cierre de mes y reiniciar a 0</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            {dailyRetryPending && <p role="alert" className="rounded-xl border border-separator bg-warning-soft p-4 text-sm text-warning-text">No se pudo confirmar el guardado. Pulsa Reintentar guardado: la misma operación no se sumará dos veces. Mantén esta página abierta hasta confirmarlo.</p>}
            <fieldset disabled={isSavingDaily || isClosingMonth || isLoadingDate || loadedDailyDate !== selectedDate} className="space-y-6">
            <section className="admin-summary" aria-label="Resumen diario de la tienda">
              <div><p className="admin-summary-label">Fecha</p><p className="admin-summary-date">{formatLongDateSantoDomingo(selectedDate)}</p><p className="text-xs text-secondary mt-1">Acumulado mes en pantalla: <strong>{monthSnapshot.manager.totalUnitsSold.toLocaleString("es-DO")} pts</strong></p></div>
              <div className="admin-summary-total"><strong>{liveManagerTotal.toLocaleString("es-DO")}</strong><p>Puntos acumulados ({selectedDate === todaySantoDomingo ? "Hoy" : formatShortDateEs(selectedDate)})</p></div>
              <div><p className="admin-summary-label">Meta mensual por vendedor</p><p className="text-2xl font-semibold tabular-nums">{monthlySellerGoal.toLocaleString("es-DO")} puntos</p>{(Boolean((snapshot.settings.monthly_seller_prize_name ?? "").trim()) || (snapshot.settings.monthly_seller_prize_value ?? 0) > 0) && <p className="text-xs text-foreground mt-1">Premio: <strong>{(snapshot.settings.monthly_seller_prize_name ?? "").trim() || "Premio por meta cumplida"}</strong>{(snapshot.settings.monthly_seller_prize_value ?? 0) > 0 ? ` · RD$${(snapshot.settings.monthly_seller_prize_value ?? 0).toLocaleString("es-DO")}` : ""}</p>}<p className="text-xs text-secondary mt-2">Meta mensual del Manager: {(snapshot.settings.default_monthly_manager_goal ?? 1000).toLocaleString("es-DO")} puntos</p></div>
            </section>

            {/* Tabla Editable de Registro Diario (Sección 7.1) */}
            <div className="overflow-hidden rounded-2xl border border-separator bg-surface shadow-subtle">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator px-5 py-4">
                <div>
                  <h3 className="font-display text-base sm:text-lg font-medium text-foreground">
                    Puntos del día
                  </h3>
                  <p className="text-xs text-secondary">
                    {dailyMode === "add" ? "Escribe solo los puntos nuevos. Los campos volverán a cero al guardar; el total se conserva." : "Escribe el total correcto de esta fecha; no se suma al anterior."}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="emerald"
                  size="lg"
                  disabled={isSavingDaily || isLoadingDate || loadedDailyDate !== selectedDate}
                  onClick={handleSaveDailyStats}
                >
                  {isSavingDaily ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>{dailyRetryPending ? "Reintentar guardado" : dailyMode === "add" ? "Aplicar suma de puntos" : "Guardar corrección"}</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-separator bg-muted text-[11px] font-medium text-secondary">
                      <th className="py-3.5 px-4 sm:px-6">Vendedor</th>
                      <th className="py-3.5 px-4 text-right w-48">
                        {dailyMode === "add" ? "Puntos a sumar" : "Total del día"}
                      </th>
                      <th className="py-3.5 px-4 text-center">En TV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-separator text-sm">
                    {rows.map((row, index) => {
                      return (
                        <tr
                          key={row.seller_id}
                          className={cn(
                            "transition-colors hover:bg-muted",
                            !row.is_active && "opacity-50"
                          )}
                        >
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <AvatarBadge
                                src={row.avatar_url}
                                name={row.full_name}
                                size="sm"
                              />
                              <div>
                                <div className="font-medium text-foreground flex items-center gap-2">
                                  <span>{row.full_name}</span>

                                </div>
                                {!row.is_active && (
                                  <span className="text-[11px] text-warning-text">
                                    Vendedor inactivo
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Input de TOTAL ACUMULADO de puntos */}
                          <td className="py-3.5 px-4 text-right">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              aria-label={dailyMode === "add" ? `Puntos a sumar a ${row.full_name}` : `Total del día de ${row.full_name}`}
                              disabled={dailyRetryPending}
                              value={dailyMode === "add" ? row.points_to_add : row.units_sold}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : Number(e.target.value);
                                setRows((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          [dailyMode === "add" ? "points_to_add" : "units_sold"]: val,
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="ml-auto w-28 sm:w-32 text-right font-display text-lg font-semibold tabular-nums text-foreground border-separator bg-muted"
                            />
                            {dailyMode === "add" && <p className="text-xs text-secondary mt-2">Hoy: {row.units_sold} · Quedará hoy: {Number(row.units_sold) + Number(row.points_to_add)} · Mes en TV: {(monthUnitsBySeller.get(row.seller_id) ?? 0) + (selectedDate >= monthSnapshot.dateFilter.startDate && selectedDate <= monthSnapshot.dateFilter.endDate ? Number(row.points_to_add) : 0)}</p>}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {row.show_on_board && row.is_active ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-text">
                                <Eye className="h-3.5 w-3.5" /> Visible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-secondary">
                                <EyeOff className="h-3.5 w-3.5" /> Oculto
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-separator bg-muted px-5 py-4">
                <div className="text-xs text-secondary">
                  Total calculado para el Manager General:{" "}
                  <strong className="text-foreground font-medium">
                    {liveManagerTotal} puntos
                  </strong>{" "}
                  · Acumulado del mes en TV: <strong className="text-foreground">{liveMonthlyTotal.toLocaleString("es-DO")} puntos</strong>
                </div>


              </div>
            </div>

            </fieldset>

            {/* Consulta de Estadísticas Acumuladas por Rango de Fechas (Sección 8) */}
            <div className="rounded-2xl border border-separator bg-surface p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-separator pb-4">
                <div>
                  <h3 className="font-display text-base font-medium text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-secondary" />
                    <span>Estadísticas por período</span>
                  </h3>
                  <p className="text-xs text-secondary">
                    Para períodos superiores a un día, suma automáticamente los registros diarios de cada vendedor sin duplicarlos.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "today", label: "Hoy" },
                      { id: "yesterday", label: "Ayer" },
                      { id: "last7days", label: "Últimos 7 días" },
                      { id: "thisMonth", label: "Este mes" },
                      { id: "custom", label: "Rango personalizado" },
                    ] as { id: DateFilterPreset; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setHistoryPreset(item.id)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                        historyPreset === item.id
                          ? "bg-accent text-white"
                          : "bg-muted text-secondary hover:bg-muted"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {historyPreset === "custom" && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-secondary">Desde:</span>
                  <input
                    type="date"
                    value={historyCustomStart}
                    onChange={(e) => setHistoryCustomStart(e.target.value)}
                    className="rounded-lg border border-separator bg-muted px-2.5 py-1 text-foreground"
                  />
                  <span className="text-secondary">Hasta:</span>
                  <input
                    type="date"
                    value={historyCustomEnd}
                    onChange={(e) => setHistoryCustomEnd(e.target.value)}
                    className="rounded-lg border border-separator bg-muted px-2.5 py-1 text-foreground"
                  />
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl border border-separator bg-accent-soft p-3">
                  <span className="text-[11px] text-secondary font-medium">
                    Total Tienda ({historySnapshot.dateFilter.label})
                  </span>
                  <p className="mt-1 font-display text-2xl font-semibold text-foreground tabular-nums">
                    {historySnapshot.manager.totalUnitsSold} puntos
                  </p>
                  <span className="text-[11px] text-secondary">
                    Meta: {historySnapshot.manager.generalGoal} (
                    {historySnapshot.manager.completionPercent}%)
                  </span>
                </div>

                {historySnapshot.rankedSellers.map((item) => (
                  <div
                    key={item.seller.id}
                    className="rounded-xl border border-separator bg-muted p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-foreground truncate">
                        {item.seller.full_name}
                      </span>
                      {item.rank && (
                        <span className="text-[10px] font-medium text-secondary">
                          #{item.rank}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-display text-xl font-semibold text-foreground tabular-nums">
                      {item.unitsSold} puntos
                    </p>
                    <span className="text-[11px] text-secondary">
                      {item.goalCompletionPercent}% de {item.effectiveGoal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            PESTAÑA 2: GESTIÓN DE VENDEDORES (Sección 7.2)
           =================================================================== */}
        {activeTab === "sellers" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Formulario para Crear / Editar vendedor */}
            <div className="lg:col-span-5 rounded-2xl border border-separator bg-surface p-5 shadow-subtle h-fit min-w-0">
              <div className="flex items-center justify-between border-b border-separator pb-3.5 mb-4">
                <h2 className="font-display text-lg font-medium text-foreground flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-secondary" />
                  <span>
                    {editingSellerId ? "Editar vendedor" : "Añadir vendedor"}
                  </span>
                </h2>
                {editingSellerId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetSellerForm}
                    disabled={isSavingSeller || isUploadingSellerPhoto}
                  >
                    Cancelar edición
                  </Button>
                )}
              </div>

              <form ref={sellerFormRef} onSubmit={handleSaveSeller} className="scroll-mt-24">
                <fieldset disabled={isSavingSeller || isUploadingSellerPhoto} className="min-w-0 space-y-4">
                  <div>
                    <label htmlFor="seller-name" className="mb-1 block text-xs font-semibold text-secondary">
                      Nombre completo *
                    </label>
                    <Input
                      id="seller-name"
                      minLength={2}
                      maxLength={60}
                      required
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      placeholder="Ej. Carlos Rodríguez"
                    />
                  </div>

                  <SellerPhotoField
                    url={sellerAvatarUrl}
                    name={sellerName}
                    color="#007AFF"
                    uploading={isUploadingSellerPhoto}
                    onChange={setSellerAvatarUrl}
                    onUpload={(file) => uploadPhotoFile(file, setSellerAvatarUrl, setIsUploadingSellerPhoto)}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="mb-1 text-xs font-semibold text-secondary">Meta mensual compartida</p><p className="py-2 text-sm font-semibold">{monthlySellerGoal} puntos/mes</p></div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-secondary">
                        Orden en tablero
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        aria-label="Orden en tablero"
                        max={999}
                        value={sellerOrder}
                        onChange={(e) =>
                          setSellerOrder(
                            Math.max(0, parseInt(e.target.value || "0", 10))
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-separator bg-muted p-3 text-xs">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium text-foreground">
                        Vendedor activo en el sistema
                      </span>
                      <input
                        type="checkbox"
                        checked={sellerActive}
                        onChange={(e) => setSellerActive(e.target.checked)}
                        className="h-4 w-4 accent-accent"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium text-foreground">
                        Mostrar barra en la pantalla pública (TV)
                      </span>
                      <input
                        type="checkbox"
                        checked={sellerShowOnBoard}
                        onChange={(e) => setSellerShowOnBoard(e.target.checked)}
                        className="h-4 w-4 accent-accent"
                      />
                    </label>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSavingSeller || isUploadingSellerPhoto}
                    className="w-full"
                  >
                    {editingSellerId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    <span>
                      {isSavingSeller
                        ? "Guardando..."
                        : editingSellerId
                        ? "Guardar vendedor"
                        : "Crear vendedor"}
                    </span>
                  </Button>
                </fieldset>
              </form>
            </div>

            {/* Lista de Vendedores registrados */}
            <div className="lg:col-span-7 rounded-2xl border border-separator bg-surface p-5 shadow-subtle">
              <h2 className="font-display text-lg font-medium text-foreground mb-1">
                Vendedores registrados ({snapshot.allSellersAdminTable.length})
              </h2>
              <p className="text-xs text-secondary mb-4">
                Pulsa «Editar datos y foto» para cambiar el nombre o la fotografía. La meta mensual es la misma para todos. Puedes desactivarlos sin perder sus puntos anteriores.
              </p>

              <div className="space-y-3">
                {snapshot.allSellersAdminTable.map(({ seller }) => (
                  <div
                    key={seller.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition-all",
                      seller.is_active
                        ? "border-separator bg-muted"
                        : "border-separator bg-muted opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBadge
                        src={seller.avatar_url}
                        name={seller.full_name}
                        size="md"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-medium text-foreground">
                            {seller.full_name}
                          </h3>

                          <span className="text-[11px] text-secondary">
                            Orden #{seller.display_order}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-secondary">
                          <span>
                            Meta mensual compartida:{" "}
                            <strong className="text-foreground">
                              {monthlySellerGoal} puntos/mes
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Creado: {formatShortDateEs(seller.created_at.slice(0, 10))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleToggleSellerProperty(seller, "show_on_board")
                        }
                        title="Mostrar u ocultar en pantalla pública"
                      >
                        {seller.show_on_board ? (
                          <>
                            <Eye className="h-3.5 w-3.5 text-success-text" />
                            <span>En TV</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5 text-secondary" />
                            <span>Oculto</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleToggleSellerProperty(seller, "is_active")
                        }
                      >
                        <UserCheck
                          className={cn(
                            "h-3.5 w-3.5",
                            seller.is_active
                              ? "text-success-text"
                              : "text-warning-text"
                          )}
                        />
                        <span>
                          {seller.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-accent"
                        onClick={() => startEditSeller(seller)}
                        disabled={isSavingSeller || isUploadingSellerPhoto}
                        aria-label={`Editar datos y foto de ${seller.full_name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar datos y foto
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            PESTAÑA 3: GESTIÓN DEL MANAGER GENERAL (Sección 7.3)
           =================================================================== */}
        {activeTab === "manager" && (
          <div className="mx-auto max-w-3xl rounded-2xl border border-separator bg-surface p-6 shadow-subtle">
            <div className="border-b border-separator pb-4 mb-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-secondary">
                Tarjeta Superior Horizontal
              </span>
              <h2 className="mt-1 font-display text-xl font-medium text-foreground">
                Configuración del Manager General y Tablero
              </h2>
              <p className="mt-1 text-xs text-secondary">
                El total de puntos del Manager General nunca se introduce manualmente; se calcula siempre en automático sumando los puntos de los vendedores.
              </p>
            </div>

            <form onSubmit={handleSaveManagerSettings}><fieldset disabled={isSavingManager || isUploadingManagerPhoto} className="space-y-5 min-w-0">
              <SellerPhotoField label="Fotografía del Manager General" url={managerAvatarUrl} name={managerName || "Manager General"} color="#007AFF" uploading={isUploadingManagerPhoto} onChange={setManagerAvatarUrl} onUpload={(file) => uploadPhotoFile(file, setManagerAvatarUrl, setIsUploadingManagerPhoto)} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-secondary">
                    Nombre del Manager General *
                  </label>
                  <Input
                    required
                    id="manager-name"
                    aria-label="Nombre del Manager General"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="Ej. Roberto Méndez"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-secondary">
                    Etiqueta Visible *
                  </label>
                  <Input
                    required
                    id="manager-label"
                    aria-label="Etiqueta visible"
                    value={managerLabel}
                    onChange={(e) => setManagerLabel(e.target.value)}
                    placeholder="MANAGER GENERAL"
                  />
                </div>



                <p className="text-sm text-secondary sm:col-span-2">Configura los objetivos mensuales de vendedores y supervisor en <button type="button" className="text-accent underline" onClick={() => setActiveTab("goals")}>Metas</button>.</p>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-secondary">
                    Título del Tablero Público
                  </label>
                  <Input
                    id="board-title"
                    aria-label="Título del tablero"
                    value={boardTitle}
                    onChange={(e) => setBoardTitle(e.target.value)}
                    placeholder="Ranking de puntos"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-secondary">
                    Nombre de la Marca / Tienda
                  </label>
                  <Input
                    id="store-name"
                    aria-label="Nombre de la tienda"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="YACELLTECH"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" size="lg" disabled={isSavingManager}>
                  <Save className="h-4 w-4" />
                  <span>
                    {isSavingManager
                      ? "Guardando configuración..."
                      : "Guardar configuración"}
                  </span>
                </Button>
              </div>
            </fieldset></form>
          </div>
        )}

        {/* ===================================================================
            PESTAÑA 4: HISTORIAL COMPLETO SIN EXCEL, AUDITORÍA Y DEMOSTRACIÓN
           =================================================================== */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            {/* Historial completo por persona y día (sin necesidad de Excel, conservando botón de exportar Excel) */}
            <PointsReports />

            {/* Inicializador Explícito y Seguro de Datos de Demostración (Sección 13) */}
            <div className="rounded-2xl border border-separator bg-surface p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-0.5 text-[11px] font-medium text-warning-text">
                    <Sparkles className="h-3.5 w-3.5" />
                    Inicialización Explícita de Demostración
                  </span>
                  <h3 className="mt-1 font-display text-lg font-medium text-foreground">
                    Cargar los 5 vendedores de prueba (Carlos, Ana, Luis, María y José)
                  </h3>
                  <p className="mt-1 text-xs text-secondary max-w-2xl">
                    Método seguro de inicialización: verifica que no existan vendedores reales de producción antes de cargar los datos ficticios.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleInitializeDemo("daily_34_of_50")}
                  >
                    <Database className="h-4 w-4 text-secondary" />
                    <span>Demo Meta 50 (34 puntos / 68%)</span>
                  </Button>

                  <Button
                    type="button"
                    variant="default"
                    onClick={() => handleInitializeDemo("high_volume_350")}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Demo Escala Alta (Luis 350, José 250...)</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Historial de Auditoría */}
            <div className="rounded-2xl border border-separator bg-surface p-5 shadow-subtle">
              <div className="flex items-center justify-between border-b border-separator pb-4 mb-4">
                <div>
                  <h3 className="font-display text-lg font-medium text-foreground">
                    Historial de cambios
                  </h3>
                  <p className="text-xs text-secondary">
                    Registro inmutable de quién modificó las estadísticas, fecha, hora y valores anteriores vs nuevos.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadAuditHistory}
                  disabled={isLoadingAudit}
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      isLoadingAudit && "animate-spin"
                    )}
                  />
                  <span>Actualizar</span>
                </Button>
              </div>

              {auditLogs.length === 0 ? (
                <p className="py-8 text-center text-sm text-secondary">
                  No hay registros de auditoría disponibles.
                </p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-separator bg-muted p-4 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-accent-soft px-2 py-0.5 font-medium text-secondary">
                            {log.action_type}
                          </span>
                          <span className="text-secondary font-semibold">
                            Responsable: {log.actor_email}
                          </span>
                          {log.sale_date && (
                            <span className="rounded bg-muted px-2 py-0.5 text-foreground">
                              Fecha ventas: {log.sale_date}
                            </span>
                          )}
                        </div>
                        <span className="text-secondary tabular-nums">
                          {formatShortDateEs(log.created_at.slice(0, 10))} •{" "}
                          {formatTimeSantoDomingo(log.created_at)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-lg bg-surface p-2.5">
                          <span className="block text-[10px] font-medium text-secondary mb-1">
                            Valores Anteriores
                          </span>
                          <pre className="overflow-x-auto text-[11px] text-secondary">
                            {JSON.stringify(log.previous_values, null, 2)}
                          </pre>
                        </div>
                        <div className="rounded-lg bg-surface p-2.5">
                          <span className="block text-[10px] font-medium text-success-text mb-1">
                            Valores Nuevos
                          </span>
                          <pre className="overflow-x-auto text-[11px] text-success-text">
                            {JSON.stringify(log.new_values, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
