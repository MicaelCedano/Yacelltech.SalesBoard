import { NextRequest, NextResponse } from "next/server";
import { createSellerRecord, updateSellerRecord } from "@/lib/data-service";
import { verifyServerAdminSession } from "@/lib/supabase/server";
import { createSellerSchema, updateSellerSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol de administrador." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createSellerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos de vendedor inválidos" },
        { status: 400 }
      );
    }

    const seller = await createSellerRecord(parsed.data, {
      userId: session.userId,
      email: session.email ?? "admin@yacelltech.com",
    });

    return NextResponse.json({ seller }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al crear vendedor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await verifyServerAdminSession();
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol de administrador." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateSellerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos de actualización inválidos" },
        { status: 400 }
      );
    }

    const seller = await updateSellerRecord(parsed.data, {
      userId: session.userId,
      email: session.email ?? "admin@yacelltech.com",
    });

    return NextResponse.json({ seller }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al actualizar vendedor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
