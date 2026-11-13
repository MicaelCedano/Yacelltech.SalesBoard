import { NextResponse } from "next/server";
import { readDemoDatabase, writeDemoDatabase } from "@/lib/demo-store";
import { getSupabaseServerClient, verifyServerAdminSession } from "@/lib/supabase/server";
import { getSantoDomingoToday } from "@/lib/date-utils";
import { z } from "zod";
import { weeklyDayOffSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const supabase = await getSupabaseServerClient();
    const today = getSantoDomingoToday();
    const date = new URL(request.url).searchParams.get("date");
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
      if (!supabase) {
        const db = readDemoDatabase();
        const status: Record<string, boolean | null> = {};
        for (const seller of db.sellers.filter(s => !s.is_manager)) {
          const history = (db.weeklyDaysOffHistory ?? []).filter(h => h.seller_id === seller.id && h.effective_date <= date).sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
          const override = db.dayOffOverrides?.[`${seller.id}:${date}`];
          status[seller.id] = override ?? (date === today ? db.weeklyDaysOff?.[seller.id] === weekday : history ? history.weekday === weekday : null);
        }
        return NextResponse.json({ date, status });
      }
      const [history, overrides] = await Promise.all([
        supabase.from("seller_weekly_days_off_history").select("seller_id,effective_date,weekday").lte("effective_date", date).order("effective_date", { ascending: false }).order("seller_id").range(0, 999),
        supabase.from("seller_day_off_overrides").select("seller_id,is_off").eq("off_date", date),
      ]);
      if (history.error || overrides.error) throw new Error("No se pudo consultar el historial de días libres.");
      const status: Record<string, boolean> = {};
      let rows = history.data ?? [];
      for (let offset = 0; rows.length; offset += 1000) {
        for (const row of rows) if (!(row.seller_id in status)) status[row.seller_id] = row.weekday === weekday;
        if (rows.length < 1000) break;
        const page = await supabase.from("seller_weekly_days_off_history").select("seller_id,effective_date,weekday").lte("effective_date", date).order("effective_date", { ascending: false }).order("seller_id").range(offset + 1000, offset + 1999);
        if (page.error) throw new Error("No se pudo consultar el historial de días libres.");
        rows = page.data ?? [];
      }
      for (const row of overrides.data ?? []) status[row.seller_id] = row.is_off;
      return NextResponse.json({ date, status });
    }
    if (!supabase) {
      const db = readDemoDatabase();
      const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
      return NextResponse.json({ daysOff: db.weeklyDaysOff ?? {}, today, todayOff: Object.fromEntries(db.sellers.map(s => [s.id, db.dayOffOverrides?.[`${s.id}:${today}`] ?? db.weeklyDaysOff?.[s.id] === weekday])) });
    }

    const { data, error } = await supabase.from("seller_weekly_days_off").select("seller_id, weekday");
    if (error) throw new Error(error.message);
    const { data: overrides, error: overrideError } = await supabase.from("seller_day_off_overrides").select("seller_id,is_off").eq("off_date", today);
    if (overrideError) throw new Error(overrideError.message);
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
    const todayOff = Object.fromEntries(data.map(({ seller_id, weekday: day }) => [seller_id, day === weekday]));
    for (const row of overrides ?? []) todayOff[row.seller_id] = row.is_off;
    return NextResponse.json({ today, todayOff, daysOff: Object.fromEntries(data.map(({ seller_id, weekday }) => [seller_id, weekday])) });
  } catch {
    return NextResponse.json({ error: "No se pudieron cargar los días libres." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const parsed = weeklyDayOffSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Selecciona un vendedor y un día válidos." }, { status: 400 });

    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.from("seller_weekly_days_off").upsert(parsed.data);
      if (error) throw new Error(error.message);
    } else {
      const db = readDemoDatabase();
      const { seller_id, weekday } = parsed.data;
      if (!db.sellers.some((seller) => seller.id === seller_id && !seller.is_manager)) {
        return NextResponse.json({ error: "Vendedor no encontrado." }, { status: 404 });
      }
      db.weeklyDaysOff = { ...db.weeklyDaysOff, [seller_id]: weekday };
      const effective_date = getSantoDomingoToday();
      db.weeklyDaysOffHistory = [...(db.weeklyDaysOffHistory ?? []).filter(h => h.seller_id !== seller_id || h.effective_date !== effective_date), { seller_id, weekday, effective_date }];
      writeDemoDatabase(db);
    }

    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el día libre." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const parsed = z.object({ seller_id: z.string().uuid(), is_off: z.boolean(), date: z.string() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success || parsed.data.date !== getSantoDomingoToday()) return NextResponse.json({ error: "Fecha o vendedor inválido; recarga la página." }, { status: 400 });
    const { seller_id, is_off, date } = parsed.data;
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data: seller, error: sellerError } = await supabase.from("sellers").select("id").eq("id", seller_id).eq("is_active", true).eq("is_manager", false).maybeSingle();
      if (sellerError || !seller) return NextResponse.json({ error: "Vendedor no encontrado." }, { status: 404 });
      const { error } = await supabase.from("seller_day_off_overrides").upsert({ seller_id, off_date: date, is_off });
      if (error) throw error;
    } else {
      const db = readDemoDatabase();
      if (!db.sellers.some(s => s.id === seller_id && s.is_active && !s.is_manager)) return NextResponse.json({ error: "Vendedor no encontrado." }, { status: 404 });
      db.dayOffOverrides = { ...db.dayOffOverrides, [`${seller_id}:${date}`]: is_off };
      writeDemoDatabase(db);
    }
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "No se pudo actualizar el día libre." }, { status: 500 }); }
}
