"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DateFilterPreset, SalesBoardSnapshot } from "@/types/salesboard";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const BROADCAST_CHANNEL_NAME = "yacelltech_salesboard_live_sync";

export function broadcastBoardUpdate() {
  if (typeof window === "undefined") return;
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: "SALESBOARD_UPDATED", timestamp: Date.now() });
      bc.close();
    }
    window.localStorage.setItem(
      "yacelltech_last_mutation_ts",
      String(Date.now())
    );
  } catch {
    // Ignore storage/broadcast errors in restricted contexts
  }
}

export type RealtimeConnectionStatus = "connected" | "reconnecting" | "polling";

export function useSalesBoardRealtime(params: {
  initialSnapshot: SalesBoardSnapshot;
  preset?: DateFilterPreset;
  customStart?: string;
  customEnd?: string;
}) {
  const {
    initialSnapshot,
    preset = "today",
    customStart,
    customEnd,
  } = params;

  const [snapshot, setSnapshot] = useState<SalesBoardSnapshot>(initialSnapshot);
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>("connected");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);

  const fetchLatestSnapshot = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const query = new URLSearchParams({ preset });
      if (preset === "custom" && customStart && customEnd) {
        query.set("startDate", customStart);
        query.set("endDate", customEnd);
      }
      const res = await fetch(`/api/board?${query.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as SalesBoardSnapshot;
      if (isMountedRef.current) {
        setSnapshot(data);
        setConnectionStatus("connected");
      }
    } catch {
      if (isMountedRef.current) {
        setConnectionStatus("reconnecting");
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [preset, customStart, customEnd]);

  // Actualizar cuando cambian los filtros de fecha
  useEffect(() => {
    void fetchLatestSnapshot();
  }, [fetchLatestSnapshot]);

  useEffect(() => {
    isMountedRef.current = true;
    const supabase = getSupabaseBrowserClient();

    // 1. Suscripción a Supabase Realtime (cuando Supabase está configurado)
    let channelCleanup: (() => void) | null = null;
    if (supabase) {
      const channel = supabase
        .channel("yacelltech-public-board")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "daily_sales" },
          () => {
            void fetchLatestSnapshot();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "daily_goals" },
          () => {
            void fetchLatestSnapshot();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sellers" },
          () => {
            void fetchLatestSnapshot();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "app_settings" },
          () => {
            void fetchLatestSnapshot();
          }
        )
        .subscribe((status) => {
          if (!isMountedRef.current) return;
          if (status === "SUBSCRIBED") {
            setConnectionStatus("connected");
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setConnectionStatus("reconnecting");
          }
        });

      channelCleanup = () => {
        void supabase.removeChannel(channel);
      };
    }

    // 2. BroadcastChannel y evento storage para sincronización instantánea entre pestañas/ventanas
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = () => {
        void fetchLatestSnapshot();
      };
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "yacelltech_last_mutation_ts") {
        void fetchLatestSnapshot();
      }
    };

    // 3. Recuperación automática al volver a tener red o foco en el televisor
    const handleOnline = () => {
      setConnectionStatus("reconnecting");
      void fetchLatestSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchLatestSnapshot();
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Heartbeat de seguridad cada 8 segundos para garantizar que una TV encendida 24/7
    // nunca quede desincronizada ni al cambiar de fecha a medianoche
    const intervalId = window.setInterval(() => {
      void fetchLatestSnapshot();
    }, 8000);

    return () => {
      isMountedRef.current = false;
      if (channelCleanup) channelCleanup();
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [fetchLatestSnapshot]);

  return {
    snapshot,
    setSnapshot,
    connectionStatus,
    isRefreshing,
    refreshNow: fetchLatestSnapshot,
  };
}
