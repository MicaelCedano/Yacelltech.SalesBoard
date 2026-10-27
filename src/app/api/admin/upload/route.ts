import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, verifyServerAdminSession } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para subir fotografías." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo de imagen válido." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPG, PNG, WEBP o AVIF." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "La fotografía está vacía. Selecciona otra imagen." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "La fotografía excede el tamaño máximo permitido (5 MB)." },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    if (supabase) {
      const extensions: Record<string, string> = {
        "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif",
      };
      const safeFileName = `avatar-${crypto.randomUUID()}.${extensions[file.type]}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(safeFileName, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Error al subir imagen a Supabase Storage: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(safeFileName);

      return NextResponse.json({ url: publicUrlData.publicUrl }, { status: 200 });
    }

    // Modo demostración local: convertir a Data URL optimizada para previsualización inmediata
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;
    return NextResponse.json({ url: dataUrl }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al procesar la fotografía";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
