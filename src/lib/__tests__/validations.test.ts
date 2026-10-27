import { describe, expect, it } from "vitest";
import { createSellerSchema, nonNegativeIntSchema, updateSellerSchema } from "@/lib/validations";

describe("Compatibilidad de validaciones alojadas", () => {
  it("no altera estado, visibilidad ni orden al editar únicamente la fotografía", () => {
    const input = { id: "11111111-1111-4111-8111-111111111111", avatar_url: null };
    expect(updateSellerSchema.parse(input)).toEqual(input);
  });

  it("mantiene los valores predeterminados al crear un vendedor", () => {
    expect(createSellerSchema.parse({
      full_name: "Vendedor prueba", bar_color: "#007AFF", individual_goal: 15,
    })).toMatchObject({ is_active: true, show_on_board: true, display_order: 0 });
  });

  it("rechaza puntos negativos, fraccionarios y fuera de límite", () => {
    for (const value of [-1, 1.5, 100001, "5", undefined]) {
      expect(nonNegativeIntSchema.safeParse(value).success).toBe(false);
    }
    expect(nonNegativeIntSchema.parse(0)).toBe(0);
  });
});
