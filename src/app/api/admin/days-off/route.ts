import { NextResponse } from "next/server";
import { readDemoDatabase, writeDemoDatabase } from "@/lib/demo-store";
import { getSupabaseServerClient, verifyServerAdminSession } from "@/lib/supabase/server";
import { weeklyDayOffSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const supabase = await getSupabaseServerClient();
    if (!supabase) return NextResponse.json({ daysOff: readDemoDatabase().weeklyDaysOff ?? {} });

    const { data, error } = await supabase.from("seller_weekly_days_off").select("seller_id, weekday");
    if (error) throw new Error(error.message);
    return NextResponse.json({
      daysOff: Object.fromEntries(data.map(({ seller_id, weekday }) => [seller_id, weekday])),
    });
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
      writeDemoDatabase(db);
    }

    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el día libre." }, { status: 500 });
  }
}
