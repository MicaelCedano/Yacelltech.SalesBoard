import crypto from "crypto";
import {
  AppSettings,
  AuditLogEntry,
  DailyGoalRecord,
  DailySaleRecord,
  DateFilterPreset,
  SalesBoardSnapshot,
  Seller,
} from "@/types/salesboard";
import {
  applyDirectCumulativeDailySalesUpdate,
  buildSalesBoardSnapshot,
} from "@/lib/calculations";
import {
  getSantoDomingoToday,
  resolveDateRangeFilter,
} from "@/lib/date-utils";
import {
  createSeedDemoDatabase,
  readDemoDatabase,
  writeDemoDatabase,
} from "@/lib/demo-store";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  BatchSaveDailySalesInput,
  CreateSellerInput,
  UpdateManagerSettingsInput,
  UpdateSellerInput,
} from "@/lib/validations";

export interface AdminActor {
  userId: string | null;
  email: string;
}

/**
 * Obtiene el estado completo del tablero para una fecha o rango de fechas.
 * Público: solo expone los campos destinados al tablero; nunca expone audit_logs ni perfiles privados.
 */
export async function fetchSalesBoardSnapshot(params?: {
  preset?: DateFilterPreset;
  customStart?: string;
  customEnd?: string;
}): Promise<SalesBoardSnapshot> {
  const today = getSantoDomingoToday();
  const preset = params?.preset ?? "today";
  const dateFilter = resolveDateRangeFilter(
    preset,
    today,
    params?.customStart,
    params?.customEnd
  );

  const supabase = await getSupabaseServerClient();

  if (supabase) {
    const [settingsRes, sellersRes, salesRes, goalsRes] = await Promise.all([
      supabase.from("app_settings").select("*").eq("id", 1).single(),
      supabase
        .from("sellers")
        .select("*")
        .order("display_order", { ascending: true })
        .order("full_name", { ascending: true }),
      supabase
        .from("daily_sales")
        .select("*")
        .gte("sale_date", dateFilter.startDate)
        .lte("sale_date", dateFilter.endDate),
      supabase
        .from("daily_goals")
        .select("*")
        .gte("goal_date", dateFilter.startDate)
        .lte("goal_date", dateFilter.endDate),
    ]);

    for (const result of [settingsRes, sellersRes, salesRes, goalsRes]) {
      if (result.error) throw new Error(`No se pudo cargar el tablero: ${result.error.message}`);
    }

    const settings: AppSettings = (settingsRes.data as AppSettings | null) ?? {
      id: 1,
      store_name: "YACELLTECH",
      board_title: "Ranking de puntos",
      manager_name: "Roberto Méndez",
      manager_label: "MANAGER GENERAL",
      manager_avatar_url: null,
      default_general_goal: 50,
      timezone: "America/Santo_Domingo",
      is_demo_environment: false,
      version: 1,
      updated_at: new Date().toISOString(),
    };

    const sellers = (sellersRes.data as Seller[] | null) ?? [];
    const dailySales = (salesRes.data as DailySaleRecord[] | null) ?? [];
    const dailyGoals = (goalsRes.data as DailyGoalRecord[] | null) ?? [];

    return buildSalesBoardSnapshot({
      settings,
      sellers,
      dailySales,
      dailyGoals,
      dateFilter,
      dataSource: "supabase",
    });
  }

  // Modo de demostración local (aislado de producción)
  const demoDb = readDemoDatabase();
  return buildSalesBoardSnapshot({
    settings: demoDb.settings,
    sellers: demoDb.sellers,
    dailySales: demoDb.dailySales,
    dailyGoals: demoDb.dailyGoals,
    dateFilter,
    dataSource: "demo-local",
  });
}

/**
 * Suma puntos o corrige totales diarios. El request_id evita duplicar reintentos.
 */
export async function saveBatchDailySales(
  input: BatchSaveDailySalesInput,
  actor: AdminActor
): Promise<{ snapshot: SalesBoardSnapshot; updatedCount: number }> {
  const nowIso = new Date().toISOString();
  const requestId = input.request_id ?? crypto.randomUUID();
  const operation = { sale_date: input.sale_date, general_goal: input.general_goal, mode: input.mode, entries: input.entries };
  const supabase = await getSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase.rpc("apply_daily_points", {
      p_request_id: requestId, p_sale_date: input.sale_date,
      p_general_goal: input.general_goal, p_entries: input.entries, p_mode: input.mode,
    });
    if (error) throw new Error(error.message);
    const snapshot = await fetchSalesBoardSnapshot({
      preset: "custom", customStart: input.sale_date, customEnd: input.sale_date,
    });
    return { snapshot, updatedCount: Number(data?.updatedCount ?? 0) };
  }
  // Modo demostración local
  const demoDb = readDemoDatabase();
  const previousRequest = demoDb.auditLogs.find((log) => log.id === requestId);
  if (previousRequest) {
    if (previousRequest.actor_id !== actor.userId || JSON.stringify(previousRequest.new_values?.request) !== JSON.stringify(operation)) {
      throw new Error("CONFLICT: Esta operación ya existe con otros datos.");
    }
    return { snapshot: await fetchSalesBoardSnapshot({ preset: "custom", customStart: input.sale_date, customEnd: input.sale_date }), updatedCount: 0 };
  }
  const existingGoal = demoDb.dailyGoals.find((g) => g.goal_date === input.sale_date);
  const previousGeneralGoal =
    existingGoal?.general_goal ?? demoDb.settings.default_general_goal;

  const { updatedSales, updatedSellers, auditDiffs } =
    applyDirectCumulativeDailySalesUpdate({
      saleDate: input.sale_date,
      existingSales: demoDb.dailySales,
      sellers: demoDb.sellers,
      updates: input.mode === "add" ? input.entries.map((entry) => {
        const previous = demoDb.dailySales.find((sale) => sale.seller_id === entry.seller_id && sale.sale_date === input.sale_date);
        const total = (previous?.units_sold ?? 0) + entry.units_sold;
        if (total > 100000) throw new Error("El total diario no puede exceder 100000 puntos");
        return { ...entry, units_sold: total, expected_version: undefined };
      }) : input.entries,
      actorId: actor.userId,
      nowIso,
    });

  demoDb.dailySales = updatedSales;
  demoDb.sellers = updatedSellers;

  const goalIndex = demoDb.dailyGoals.findIndex((g) => g.goal_date === input.sale_date);
  if (goalIndex >= 0) {
    demoDb.dailyGoals[goalIndex] = {
      ...demoDb.dailyGoals[goalIndex]!,
      general_goal: input.general_goal,
      updated_by: actor.userId,
      updated_at: nowIso,
    };
  } else {
    demoDb.dailyGoals.push({
      id: `goal-${input.sale_date}`,
      goal_date: input.sale_date,
      general_goal: input.general_goal,
      updated_by: actor.userId,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  demoDb.settings.updated_at = nowIso;

  demoDb.auditLogs.unshift({
    id: requestId,
    actor_id: actor.userId,
    actor_email: actor.email,
    action_type: "BATCH_DAILY_SALES_UPDATE",
    entity_type: "daily_sales",
    entity_id: input.sale_date,
    sale_date: input.sale_date,
    previous_values: {
      general_goal: previousGeneralGoal,
      sellers: auditDiffs.map((d) => ({
        seller_id: d.seller_id, seller_name: d.seller_name,
        units_sold: d.previous_units,
        individual_goal: d.previous_goal,
      })),
    },
    new_values: {
      general_goal: input.general_goal,
      request: operation,
      sellers: auditDiffs.map((d) => ({
        seller_id: d.seller_id, seller_name: d.seller_name,
        units_sold: d.new_units,
        individual_goal: d.new_goal,
      })),
    },
    created_at: nowIso,
  });

  writeDemoDatabase(demoDb);

  const snapshot = await fetchSalesBoardSnapshot({
    preset: "custom",
    customStart: input.sale_date,
    customEnd: input.sale_date,
  });

  return { snapshot, updatedCount: auditDiffs.length };
}

/**
 * Crea un nuevo vendedor sin alterar historiales previos.
 */
export async function createSellerRecord(
  input: CreateSellerInput,
  actor: AdminActor
): Promise<Seller> {
  const nowIso = new Date().toISOString();
  const supabase = await getSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("sellers")
      .insert({
        full_name: input.full_name,
        avatar_url: input.avatar_url ?? null,
        bar_color: input.bar_color,
        individual_goal: input.individual_goal,
        is_active: input.is_active,
        show_on_board: input.show_on_board,
        display_order: input.display_order,
        is_demo: false,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`No se pudo crear el vendedor: ${error?.message ?? "Error desconocido"}`);
    }

    await supabase.from("audit_logs").insert({
      actor_id: actor.userId,
      actor_email: actor.email,
      action_type: "SELLER_CREATED",
      entity_type: "sellers",
      entity_id: data.id,
      previous_values: null,
      new_values: data,
    });

    return data as Seller;
  }

  const demoDb = readDemoDatabase();
  const newSeller: Seller = {
    id: crypto.randomUUID(),
    full_name: input.full_name,
    avatar_url: input.avatar_url ?? null,
    bar_color: input.bar_color,
    individual_goal: input.individual_goal,
    is_active: input.is_active,
    show_on_board: input.show_on_board,
    display_order:
      input.display_order > 0 ? input.display_order : demoDb.sellers.length + 1,
    is_demo: true,
    created_at: nowIso,
    updated_at: nowIso,
  };

  demoDb.sellers.push(newSeller);
  demoDb.settings.updated_at = nowIso;
  demoDb.auditLogs.unshift({
    id: crypto.randomUUID(),
    actor_id: actor.userId,
    actor_email: actor.email,
    action_type: "SELLER_CREATED",
    entity_type: "sellers",
    entity_id: newSeller.id,
    sale_date: null,
    previous_values: null,
    new_values: {
      full_name: newSeller.full_name,
      avatar_url: newSeller.avatar_url,
      display_order: newSeller.display_order,
      individual_goal: newSeller.individual_goal,
      bar_color: newSeller.bar_color,
      is_active: newSeller.is_active,
      show_on_board: newSeller.show_on_board,
    },
    created_at: nowIso,
  });

  writeDemoDatabase(demoDb);
  return newSeller;
}

/**
 * Actualiza o desactiva un vendedor existente conservando su historial.
 */
export async function updateSellerRecord(
  input: UpdateSellerInput,
  actor: AdminActor
): Promise<Seller> {
  const nowIso = new Date().toISOString();
  const supabase = await getSupabaseServerClient();

  if (supabase) {
    const { data: prevSeller } = await supabase
      .from("sellers")
      .select("*")
      .eq("id", input.id)
      .single();

    const updatePayload: Record<string, unknown> = { updated_at: nowIso };
    if (input.full_name !== undefined) updatePayload.full_name = input.full_name;
    if (input.avatar_url !== undefined) updatePayload.avatar_url = input.avatar_url;
    if (input.bar_color !== undefined) updatePayload.bar_color = input.bar_color;
    if (input.individual_goal !== undefined)
      updatePayload.individual_goal = input.individual_goal;
    if (input.is_active !== undefined) updatePayload.is_active = input.is_active;
    if (input.show_on_board !== undefined)
      updatePayload.show_on_board = input.show_on_board;
    if (input.display_order !== undefined)
      updatePayload.display_order = input.display_order;

    const { data, error } = await supabase
      .from("sellers")
      .update(updatePayload)
      .eq("id", input.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(
        `No se pudo actualizar el vendedor: ${error?.message ?? "Error desconocido"}`
      );
    }

    await supabase.from("audit_logs").insert({
      actor_id: actor.userId,
      actor_email: actor.email,
      action_type: "SELLER_UPDATED",
      entity_type: "sellers",
      entity_id: input.id,
      previous_values: prevSeller ?? null,
      new_values: data,
    });

    return data as Seller;
  }

  const demoDb = readDemoDatabase();
  const idx = demoDb.sellers.findIndex((s) => s.id === input.id);
  if (idx < 0) {
    throw new Error("Vendedor no encontrado");
  }

  const previous = { ...demoDb.sellers[idx]! };
  const updated: Seller = {
    ...previous,
    full_name: input.full_name ?? previous.full_name,
    avatar_url:
      input.avatar_url !== undefined ? input.avatar_url : previous.avatar_url,
    bar_color: input.bar_color ?? previous.bar_color,
    individual_goal: input.individual_goal ?? previous.individual_goal,
    is_active: input.is_active ?? previous.is_active,
    show_on_board: input.show_on_board ?? previous.show_on_board,
    display_order: input.display_order ?? previous.display_order,
    updated_at: nowIso,
  };

  demoDb.sellers[idx] = updated;
  demoDb.settings.updated_at = nowIso;
  demoDb.auditLogs.unshift({
    id: crypto.randomUUID(),
    actor_id: actor.userId,
    actor_email: actor.email,
    action_type: "SELLER_UPDATED",
    entity_type: "sellers",
    entity_id: updated.id,
    sale_date: null,
    previous_values: {
      full_name: previous.full_name,
      avatar_url: previous.avatar_url,
      display_order: previous.display_order,
      individual_goal: previous.individual_goal,
      bar_color: previous.bar_color,
      is_active: previous.is_active,
      show_on_board: previous.show_on_board,
    },
    new_values: {
      full_name: updated.full_name,
      avatar_url: updated.avatar_url,
      display_order: updated.display_order,
      individual_goal: updated.individual_goal,
      bar_color: updated.bar_color,
      is_active: updated.is_active,
      show_on_board: updated.show_on_board,
    },
    created_at: nowIso,
  });

  writeDemoDatabase(demoDb);
  return updated;
}

/**
 * Actualiza la configuración del Manager General y meta general predeterminada.
 * Nota: El total del Manager nunca se introduce manualmente; siempre se calcula desde las ventas.
 */
export async function updateManagerSettingsRecord(
  input: UpdateManagerSettingsInput,
  actor: AdminActor
): Promise<AppSettings> {
  const nowIso = new Date().toISOString();
  const supabase = await getSupabaseServerClient();

  if (supabase) {
    const { data: currentSettings } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (
      currentSettings &&
      input.expected_version &&
      currentSettings.version !== input.expected_version
    ) {
      throw new Error(
        "CONFLICT: La configuración del Manager fue modificada por otro administrador. Recarga la página."
      );
    }

    const nextVersion = ((currentSettings as AppSettings | null)?.version ?? 1) + 1;

    const { data, error } = await supabase
      .from("app_settings")
      .update({
        store_name: input.store_name,
        board_title: input.board_title,
        manager_name: input.manager_name,
        manager_label: input.manager_label,
        manager_avatar_url:
          input.manager_avatar_url !== undefined
            ? input.manager_avatar_url
            : (currentSettings as AppSettings | null)?.manager_avatar_url ?? null,
        default_general_goal: input.default_general_goal,
        version: nextVersion,
        updated_by: actor.userId,
        updated_at: nowIso,
      })
      .eq("id", 1)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(
        `Error al actualizar Manager General: ${error?.message ?? "Error desconocido"}`
      );
    }

    // También actualizar la meta del día actual si existe registro para hoy
    const today = getSantoDomingoToday();
    await supabase.from("daily_goals").upsert(
      {
        goal_date: today,
        general_goal: input.default_general_goal,
        updated_by: actor.userId,
        updated_at: nowIso,
      },
      { onConflict: "goal_date" }
    );

    await supabase.from("audit_logs").insert({
      actor_id: actor.userId,
      actor_email: actor.email,
      action_type: "MANAGER_SETTINGS_UPDATED",
      entity_type: "app_settings",
      entity_id: "1",
      previous_values: currentSettings ?? null,
      new_values: data,
    });

    return data as AppSettings;
  }

  const demoDb = readDemoDatabase();
  const previous = { ...demoDb.settings };
  const updated: AppSettings = {
    ...previous,
    store_name: input.store_name,
    board_title: input.board_title,
    manager_name: input.manager_name,
    manager_label: input.manager_label,
    manager_avatar_url:
      input.manager_avatar_url !== undefined
        ? input.manager_avatar_url
        : previous.manager_avatar_url,
    default_general_goal: input.default_general_goal,
    version: previous.version + 1,
    updated_by: actor.userId,
    updated_at: nowIso,
  };

  demoDb.settings = updated;

  const today = getSantoDomingoToday();
  const todayGoalIdx = demoDb.dailyGoals.findIndex((g) => g.goal_date === today);
  if (todayGoalIdx >= 0) {
    demoDb.dailyGoals[todayGoalIdx]!.general_goal = input.default_general_goal;
    demoDb.dailyGoals[todayGoalIdx]!.updated_at = nowIso;
  }

  demoDb.auditLogs.unshift({
    id: crypto.randomUUID(),
    actor_id: actor.userId,
    actor_email: actor.email,
    action_type: "MANAGER_SETTINGS_UPDATED",
    entity_type: "app_settings",
    entity_id: "1",
    sale_date: null,
    previous_values: {
      manager_name: previous.manager_name,
      manager_label: previous.manager_label,
      default_general_goal: previous.default_general_goal,
    },
    new_values: {
      manager_name: updated.manager_name,
      manager_label: updated.manager_label,
      default_general_goal: updated.default_general_goal,
    },
    created_at: nowIso,
  });

  writeDemoDatabase(demoDb);
  return updated;
}

/**
 * Obtiene el historial de cambios (solo accesible para administradores autenticados).
 */
export async function fetchAuditLogs(limit = 40): Promise<AuditLogEntry[]> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`No se pudo cargar el historial: ${error.message}`);
    }
    return (data as AuditLogEntry[]) ?? [];
  }

  const demoDb = readDemoDatabase();
  return demoDb.auditLogs.slice(0, limit);
}

/**
 * Inicializa explícita y seguramente los datos de demostración (5 vendedores con cantidades y metas).
 * Verifica que no existan vendedores reales de producción (`is_demo = false`) antes de proceder.
 */
export async function initializeExplicitDemoData(
  preset: "daily_34_of_50" | "high_volume_350",
  actor: AdminActor
): Promise<SalesBoardSnapshot> {
  const today = getSantoDomingoToday();
  const supabase = await getSupabaseServerClient();

  if (supabase) {
    // Seguridad: Verificar que no existan vendedores reales de producción
    const { count, error: countError } = await supabase
      .from("sellers")
      .select("*", { count: "exact", head: true })
      .eq("is_demo", false);

    if (countError) {
      throw new Error(countError.message);
    }

    if ((count ?? 0) > 0) {
      throw new Error(
        "Operación bloqueada por seguridad: Existen vendedores reales de producción. No se permite mezclar datos de demostración con producción."
      );
    }

    const { error: rpcError } = await supabase.rpc("initialize_demo_salesboard", {
      target_date: today,
    });

    if (rpcError) {
      throw new Error(`Error al inicializar demo en Supabase: ${rpcError.message}`);
    }

    return fetchSalesBoardSnapshot({ preset: "today" });
  }

  const freshDemo = createSeedDemoDatabase(preset, today);
  freshDemo.auditLogs[0]!.actor_email = actor.email;
  writeDemoDatabase(freshDemo);

  return fetchSalesBoardSnapshot({ preset: "today" });
}
