import { DateFilterPreset, DateRangeFilter } from "@/types/salesboard";

export const SANTO_DOMINGO_TZ = "America/Santo_Domingo";

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD dentro de la zona horaria America/Santo_Domingo.
 */
export function getSantoDomingoToday(referenceDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SANTO_DOMINGO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(referenceDate);
}

/**
 * Suma o resta días a una fecha YYYY-MM-DD de forma determinista en UTC sin problemas de horario de verano.
 */
export function addDaysToDateString(dateStr: string, deltaDays: number): string {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * Obtiene el primer día del mes para una fecha YYYY-MM-DD dada.
 */
export function getFirstDayOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/**
 * Devuelve todos los días YYYY-MM-DD (inclusive) entre startDate y endDate.
 */
export function enumerateDatesBetween(startDate: string, endDate: string): string[] {
  if (startDate > endDate) {
    return [];
  }
  const result: string[] = [];
  let current = startDate;
  let guard = 0;
  while (current <= endDate && guard < 3660) {
    result.push(current);
    current = addDaysToDateString(current, 1);
    guard++;
  }
  return result;
}

/**
 * Resuelve un filtro de fecha (Hoy, Ayer, Últimos 7 días, Este mes, Rango personalizado)
 * garantizando consistencia con la zona horaria de Santo Domingo.
 */
export function resolveDateRangeFilter(
  preset: DateFilterPreset,
  referenceToday: string = getSantoDomingoToday(),
  customStart?: string,
  customEnd?: string
): DateRangeFilter {
  switch (preset) {
    case "today":
      return {
        preset: "today",
        startDate: referenceToday,
        endDate: referenceToday,
        label: "Hoy",
      };

    case "yesterday": {
      const yesterday = addDaysToDateString(referenceToday, -1);
      return {
        preset: "yesterday",
        startDate: yesterday,
        endDate: yesterday,
        label: "Ayer",
      };
    }

    case "last7days": {
      const start = addDaysToDateString(referenceToday, -6);
      return {
        preset: "last7days",
        startDate: start,
        endDate: referenceToday,
        label: "Últimos 7 días",
      };
    }

    case "thisMonth": {
      const start = getFirstDayOfMonth(referenceToday);
      return {
        preset: "thisMonth",
        startDate: start,
        endDate: referenceToday,
        label: "Este mes",
      };
    }

    case "custom": {
      const validStart =
        customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart) ? customStart : referenceToday;
      const validEnd =
        customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : validStart;
      const orderedStart = validStart <= validEnd ? validStart : validEnd;
      const orderedEnd = validStart <= validEnd ? validEnd : validStart;
      return {
        preset: "custom",
        startDate: orderedStart,
        endDate: orderedEnd,
        label:
          orderedStart === orderedEnd
            ? formatShortDateEs(orderedStart)
            : `${formatShortDateEs(orderedStart)} – ${formatShortDateEs(orderedEnd)}`,
      };
    }
  }
}

/**
 * Formatea una fecha YYYY-MM-DD en español largo (ej. "martes, 27 de octubre de 2026").
 */
export function formatLongDateSantoDomingo(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  // Usamos mediodía UTC para evitar desfase al formatear
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: SANTO_DOMINGO_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
}

/**
 * Formatea una fecha YYYY-MM-DD en formato corto legible (ej. "27 oct 2026").
 */
export function formatShortDateEs(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: SANTO_DOMINGO_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dt);
}

/**
 * Formatea un timestamp ISO en la hora local de Santo Domingo (ej. "02:54:10 p. m.").
 */
export function formatTimeSantoDomingo(isoString: string): string {
  try {
    const dt = new Date(isoString);
    if (Number.isNaN(dt.getTime())) return "--:--";
    return new Intl.DateTimeFormat("es-DO", {
      timeZone: SANTO_DOMINGO_TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(dt);
  } catch {
    return "--:--";
  }
}
