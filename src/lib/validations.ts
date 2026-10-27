import { z } from "zod";

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato YYYY-MM-DD");

export const hexColorSchema = z
  .string()
  .regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/, "El color debe ser un código hexadecimal válido (ej. #0EA5E9)");

export const nonNegativeIntSchema = z
  .number({
    error: (issue) => issue.input === undefined
      ? "Este campo es obligatorio"
      : "Debe ser un número entero válido",
  })
  .int("Solo se permiten números enteros de puntos")
  .min(0, "La cantidad de puntos no puede ser negativa")
  .max(100000, "El valor excede el límite permitido");

export const dailySaleItemInputSchema = z.object({
  seller_id: z.string().uuid("ID de vendedor inválido"),
  units_sold: nonNegativeIntSchema,
  individual_goal: nonNegativeIntSchema,
  expected_version: z.number().int().min(0).optional(),
});

export const batchSaveDailySalesSchema = z.object({
  sale_date: dateStringSchema,
  general_goal: nonNegativeIntSchema,
  entries: z
    .array(dailySaleItemInputSchema)
    .min(1, "Debe incluir al menos un vendedor para guardar"),
});

export const createSellerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(60, "El nombre no puede exceder 60 caracteres"),
  avatar_url: z.string().url("URL de fotografía inválida").nullable().optional(),
  bar_color: hexColorSchema,
  individual_goal: nonNegativeIntSchema,
  is_active: z.boolean().default(true),
  show_on_board: z.boolean().default(true),
  display_order: z.number().int().min(0).max(999).default(0),
});

export const updateSellerSchema = createSellerSchema.partial().extend({
  id: z.string().uuid("ID de vendedor inválido"),
  // Una edición parcial no debe restablecer valores omitidos con los defaults de creación.
  is_active: z.boolean().optional(),
  show_on_board: z.boolean().optional(),
  display_order: z.number().int().min(0).max(999).optional(),
});

export const updateManagerSettingsSchema = z.object({
  store_name: z
    .string()
    .trim()
    .min(2, "El nombre de la tienda es obligatorio")
    .max(50, "Máximo 50 caracteres")
    .default("YACELLTECH"),
  board_title: z
    .string()
    .trim()
    .min(2, "El título del tablero es obligatorio")
    .max(80, "Máximo 80 caracteres")
    .default("Ranking de puntos"),
  manager_name: z
    .string()
    .trim()
    .min(2, "El nombre del Manager General debe tener al menos 2 caracteres")
    .max(70, "Máximo 70 caracteres"),
  manager_label: z
    .string()
    .trim()
    .min(2, "La etiqueta es obligatoria")
    .max(40, "Máximo 40 caracteres")
    .default("MANAGER GENERAL"),
  manager_avatar_url: z.string().url("URL de fotografía inválida").nullable().optional(),
  default_general_goal: nonNegativeIntSchema,
  expected_version: z.number().int().min(1).optional(),
});

export const loginCredentialsSchema = z.object({
  email: z.string().trim().email("Introduce un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type BatchSaveDailySalesInput = z.infer<typeof batchSaveDailySalesSchema>;
export type CreateSellerInput = z.infer<typeof createSellerSchema>;
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;
export type UpdateManagerSettingsInput = z.infer<typeof updateManagerSettingsSchema>;
export type LoginCredentialsInput = z.infer<typeof loginCredentialsSchema>;
