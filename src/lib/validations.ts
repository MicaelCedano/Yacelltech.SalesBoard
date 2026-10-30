import { z } from "zod";

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "La fecha no existe");

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

export const prizeValueSchema = z
  .number({
    error: (issue) =>
      issue.input === undefined
        ? "Este campo es obligatorio"
        : "El valor del premio debe ser un número entero válido",
  })
  .int("El valor del premio en RD$ debe ser un número entero")
  .min(0, "El valor del premio no puede ser negativo")
  .max(100000000, "El valor del premio excede el límite permitido");

export const dailySaleItemInputSchema = z.object({
  seller_id: z.string().uuid("ID de vendedor inválido"),
  units_sold: nonNegativeIntSchema,
  // Compatibilidad con clientes anteriores; las metas antiguas no se aplican.
  individual_goal: nonNegativeIntSchema.optional(),
  expected_version: z.number().int().min(0).optional(),
});

export const batchSaveDailySalesSchema = z.object({
  request_id: z.string().uuid().optional(),
  mode: z.enum(["add", "set"]).default("set"),
  sale_date: dateStringSchema,
  general_goal: nonNegativeIntSchema.optional(),
  entries: z
    .array(dailySaleItemInputSchema)
    .min(1, "Debe incluir al menos un vendedor para guardar")
    .max(500)
    .refine((entries) => new Set(entries.map((entry) => entry.seller_id)).size === entries.length, "Hay vendedores duplicados"),
}).refine((input) => input.mode !== "add" || Boolean(input.request_id), "La suma necesita un identificador de operación");

export const pointsReportRangeSchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
}).refine((range) => range.startDate <= range.endDate, "La fecha inicial no puede ser posterior a la final")
  .refine((range) => (Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400000 < 366, "Selecciona un rango de hasta 366 días");

export const createSellerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(60, "El nombre no puede exceder 60 caracteres"),
  avatar_url: z.string().url("URL de fotografía inválida").nullable().optional(),
  bar_color: hexColorSchema,
  individual_goal: nonNegativeIntSchema.optional(),
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
  default_general_goal: nonNegativeIntSchema.optional(),
  default_monthly_seller_goal: nonNegativeIntSchema,
  // Los clientes anteriores pueden omitirlo; conservar el objetivo almacenado.
  default_monthly_manager_goal: nonNegativeIntSchema.optional(),
  monthly_seller_prize_name: z
    .string()
    .trim()
    .max(120, "El nombre del premio no puede exceder 120 caracteres")
    .nullable()
    .optional(),
  monthly_seller_prize_value: prizeValueSchema.nullable().optional(),
  expected_version: z.number().int().min(1).optional(),
});

export const loginCredentialsSchema = z.object({
  email: z.string().trim().email("Introduce un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const closeMonthSalesSchema = z.object({
  request_id: z.string().uuid().optional(),
  mode: z.literal("close_month"),
  sale_date: dateStringSchema.optional(),
});

export type BatchSaveDailySalesInput = z.infer<typeof batchSaveDailySalesSchema>;
export type CloseMonthSalesInput = z.infer<typeof closeMonthSalesSchema>;
export type CreateSellerInput = z.infer<typeof createSellerSchema>;
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;
export type UpdateManagerSettingsInput = z.infer<typeof updateManagerSettingsSchema>;
export type LoginCredentialsInput = z.infer<typeof loginCredentialsSchema>;
