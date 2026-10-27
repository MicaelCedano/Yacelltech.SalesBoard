import { afterEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { getSupabaseServerClient, verifyServerAdminSession } from "@/lib/supabase/server";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("Autenticación alojada", () => {
  it("rechaza el fallback demo en producción aunque se presente una cookie demo", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: "authenticated_admin" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    await expect(verifyServerAdminSession()).rejects.toThrow("Configura Supabase");
    expect(cookies).not.toHaveBeenCalled();
  });

  it("conserva la demostración sin credenciales durante desarrollo local", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    await expect(getSupabaseServerClient()).resolves.toBeNull();
  });
});
