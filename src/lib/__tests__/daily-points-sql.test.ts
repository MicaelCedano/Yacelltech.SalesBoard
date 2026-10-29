import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VIEWER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SELLER = "11111111-1111-4111-8111-111111111111";
let db: PGlite;
const entry = (points: number, version = 0) => ({ seller_id: SELLER, units_sold: points, individual_goal: 20, expected_version: version });
const apply = (points: number, options: { id?: string; date?: string; mode?: string; version?: number; entries?: unknown[] } = {}) => db.query<{ result: { replayed: boolean } }>(
  "select public.apply_daily_points($1::uuid, $2::date, 100, $3::jsonb, $4::text) as result",
  [options.id ?? crypto.randomUUID(), options.date ?? "2026-10-27", JSON.stringify(options.entries ?? [entry(points, options.version)]), options.mode ?? "add"],
);
const total = async () => (await db.query<{ total: number }>("select coalesce(sum(units_sold), 0)::int total from public.daily_sales")).rows[0]!.total;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  const initial = readFileSync("supabase/migrations/0001_initial_schema.sql", "utf8");
  for (const table of ["profiles", "sellers", "daily_goals", "daily_sales", "audit_logs"]) {
    const definition = initial.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]+?\\n\\);`))![0];
    // Only the auth.users FK is outside the feature's schema under test.
    await db.exec(definition.replace("REFERENCES auth.users(id) ON DELETE CASCADE", ""));
  }
  await db.exec(`create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;
    insert into public.profiles(id,email,role) values ('${ADMIN}','admin@example.com','admin'), ('${VIEWER}','viewer@example.com','viewer');
    grant select on public.profiles to authenticated;
    grant select, insert, update on public.sellers, public.daily_sales, public.daily_goals to authenticated;
    grant select, insert on public.audit_logs to authenticated;
    alter table public.sellers enable row level security;
    alter table public.daily_sales enable row level security;
    alter table public.daily_goals enable row level security;
    alter table public.audit_logs enable row level security;`);
  for (const table of ["sellers", "daily_sales", "daily_goals"]) await db.exec(`
    create policy read_all on public.${table} for select to authenticated using (true);
    create policy admin_insert on public.${table} for insert to authenticated with check (public.is_admin());
    create policy admin_update on public.${table} for update to authenticated using (public.is_admin()) with check (public.is_admin());`);
  await db.exec(`create policy admin_read on public.audit_logs for select to authenticated using (public.is_admin());
    create policy admin_insert on public.audit_logs for insert to authenticated with check (public.is_admin());`);
  await db.exec(readFileSync("supabase/migrations/20261028024623_daily_points_additive.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261029223345_monthly_goals_only.sql", "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec(`reset role; truncate public.audit_logs, public.daily_sales, public.daily_goals, public.sellers;
    insert into public.sellers(id,full_name) values ('${SELLER}','Ana');
    select set_config('request.jwt.claim.sub','${ADMIN}',false); set role authenticated;`);
});
afterAll(async () => { await db?.close(); });

describe("Guardado atómico en PostgreSQL", () => {
  it("acepta puntos sin metas diarias y conserva las metas históricas ante clientes anteriores", async () => {
    await db.exec(`insert into public.daily_goals(goal_date,general_goal) values ('2026-10-27',75);
      update public.sellers set individual_goal=13 where id='${SELLER}';`);
    await apply(3, { entries: [{ seller_id: SELLER, units_sold: 3 }] });
    expect((await db.query<{ individual_goal_snapshot: number }>("select individual_goal_snapshot from public.daily_sales")).rows[0]!.individual_goal_snapshot).toBe(0);
    await db.exec("update public.daily_sales set individual_goal_snapshot=17");
    await apply(4); // El cliente anterior todavía envía individual_goal=20 y p_general_goal=100.
    expect(await total()).toBe(7);
    expect((await db.query<{ individual_goal_snapshot: number }>("select individual_goal_snapshot from public.daily_sales")).rows[0]!.individual_goal_snapshot).toBe(17);
    expect((await db.query<{ individual_goal: number }>("select individual_goal from public.sellers")).rows[0]!.individual_goal).toBe(13);
    expect((await db.query<{ general_goal: number }>("select general_goal from public.daily_goals")).rows).toEqual([{ general_goal: 75 }]);
  });
  it("suma aplicaciones y conserva cada fecha para el acumulado mensual", async () => {
    await apply(10); await apply(7); await apply(5, { date: "2026-10-28" });
    expect(await total()).toBe(22);
    expect((await db.query<{ units_sold: number }>("select units_sold from public.daily_sales where sale_date='2026-10-27'")).rows[0]!.units_sold).toBe(17);
  });
  it("un reintento no duplica puntos ni versiones y no acepta otro contenido con el mismo ID", async () => {
    const id = crypto.randomUUID(); await apply(10, { id });
    expect((await apply(10, { id })).rows[0]!.result.replayed).toBe(true);
    expect(await total()).toBe(10);
    expect((await db.query<{ version: number }>("select version from public.daily_sales")).rows[0]!.version).toBe(1);
    await expect(apply(11, { id })).rejects.toThrow("CONFLICT");
    expect(await total()).toBe(10);
  });
  it("rechaza una corrección desactualizada y conserva el delta negativo de una corrección válida", async () => {
    await apply(10); await apply(7);
    await expect(apply(8, { mode: "set", version: 0 })).rejects.toThrow("CONFLICT");
    await apply(8, { mode: "set", version: 2 });
    expect(await total()).toBe(8);
    const { rows } = await db.query<{ previous: number; next: number }>("select (previous_values->'sellers'->0->>'units_sold')::int previous, (new_values->'sellers'->0->>'units_sold')::int next from public.audit_logs where new_values->'request'->>'mode'='set'");
    expect(rows[0]).toEqual({ previous: 17, next: 8 });
  });
  it("revierte toda la operación si falla un vendedor posterior", async () => {
    await expect(apply(10, { entries: [entry(10), { ...entry(5), seller_id: "99999999-9999-4999-8999-999999999999" }] })).rejects.toThrow("Vendedor no encontrado");
    expect(await total()).toBe(0);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(0);
    expect((await db.query("select * from public.daily_goals")).rows).toHaveLength(0);
  });
  it("rechaza duplicados, cantidades negativas y desbordamiento sin alterar el total", async () => {
    await expect(apply(1, { entries: [entry(1), entry(2)] })).rejects.toThrow("duplicados");
    await expect(apply(-1)).rejects.toThrow("enteros");
    await apply(100000);
    await expect(apply(1)).rejects.toThrow("100000");
    expect(await total()).toBe(100000);
  });
  it("deniega la ejecución anónima y los usuarios sin rol administrador", async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${VIEWER}',false);`);
    await expect(apply(10)).rejects.toThrow("No autorizado");
    await db.exec("reset role; set role anon;");
    await expect(apply(10)).rejects.toThrow("permission denied for function");
  });
});
