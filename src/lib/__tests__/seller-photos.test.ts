import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/upload/route";
import { getSupabaseServerClient, verifyServerAdminSession } from "@/lib/supabase/server";
import { createSeedDemoDatabase, readDemoDatabase, writeDemoDatabase } from "@/lib/demo-store";
import { updateSellerRecord } from "@/lib/data-service";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
  verifyServerAdminSession: vi.fn(),
}));
vi.mock("@/lib/demo-store", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/demo-store")>(),
  readDemoDatabase: vi.fn(),
  writeDemoDatabase: vi.fn(),
}));

function uploadRequest(file: File) {
  const data = new FormData();
  data.set("file", file);
  return new NextRequest("http://localhost/api/admin/upload", { method: "POST", body: data });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSupabaseServerClient).mockResolvedValue(null);
  vi.mocked(verifyServerAdminSession).mockResolvedValue({
    isAdmin: true, userId: "admin-id", email: "admin@example.com", mode: "demo-local",
  });
});

describe("Fotografías y edición de vendedores", () => {
  it("exige administrador antes de procesar una fotografía", async () => {
    vi.mocked(verifyServerAdminSession).mockResolvedValue({
      isAdmin: false, userId: null, email: null, mode: "demo-local",
    });
    const response = await POST(uploadRequest(new File(["image"], "foto.png", { type: "image/png" })));
    expect(response.status).toBe(403);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it.each([
    new File(["text"], "foto.txt", { type: "text/plain" }),
    new File([], "vacia.png", { type: "image/png" }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" }),
  ])("rechaza un archivo no permitido, vacío o mayor de 5 MB: $name", async (file) => {
    const response = await POST(uploadRequest(file));
    expect(response.status).toBe(400);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("devuelve una fotografía persistible en la demostración local", async () => {
    const response = await POST(uploadRequest(new File(["image"], "foto.png", { type: "image/png" })));
    expect(response.status).toBe(200);
    expect((await response.json()).url).toBe("data:image/png;base64,aW1hZ2U=");
  });

  it("usa el MIME para la extensión y crea un objeto nuevo en Storage", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/avatar.png" } });
    const from = vi.fn().mockReturnValue({ upload, getPublicUrl });
    vi.mocked(getSupabaseServerClient).mockResolvedValue({ storage: { from } } as unknown as NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>);
    const response = await POST(uploadRequest(new File(["image"], "nombre.html", { type: "image/png" })));
    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("avatars");
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^avatar-[\da-f-]+\.png$/), expect.any(ArrayBuffer), { contentType: "image/png", upsert: false });
  });

  it("edita datos y foto sin cambiar ventas anteriores, y permite quitar la foto", async () => {
    const db = createSeedDemoDatabase("daily_34_of_50");
    const seller = db.sellers[0]!;
    const salesBefore = structuredClone(db.dailySales);
    const oldAvatar = seller.avatar_url;
    vi.mocked(readDemoDatabase).mockReturnValue(db);
    const actor = { userId: "admin-id", email: "admin@example.com" };
    const edited = await updateSellerRecord({ id: seller.id, full_name: "Nombre editado", avatar_url: "https://example.com/nueva.png", individual_goal: 20 }, actor);
    expect(edited.full_name).toBe("Nombre editado");
    expect(db.dailySales).toEqual(salesBefore);
    expect(db.auditLogs[0]?.previous_values).toMatchObject({ avatar_url: oldAvatar });
    expect(db.auditLogs[0]?.new_values).toMatchObject({ avatar_url: "https://example.com/nueva.png" });
    expect(writeDemoDatabase).toHaveBeenCalledWith(db);
    const withoutPhoto = await updateSellerRecord({ id: seller.id, avatar_url: null }, actor);
    expect(withoutPhoto.avatar_url).toBeNull();
    expect(db.dailySales).toEqual(salesBefore);
  });
});
