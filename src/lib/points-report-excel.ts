import ExcelJS from "exceljs";
import type { PointsReport } from "@/types/points-report";

const HISTORY_NOTE =
  "El detalle diario contiene los totales guardados. Movimientos muestra los cambios disponibles en la auditoría; los registros anteriores pueden no tener desglose de cada aplicación.";
const excelDate = (date: string) => new Date(`${date}T00:00:00Z`);

const DAY_NAMES_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function getDayOfWeekEs(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] ?? 2026;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return DAY_NAMES_ES[dt.getUTCDay()] ?? "";
}

/**
 * Genera el reporte en Excel de un vendedor específico con su resumen completo,
 * registro día a día con puntos asignados y acumulado progresivo, y auditoría.
 */
async function createSingleSellerReportExcel(
  report: PointsReport,
  seller: PointsReport["sellers"][number]
) {
  const book = new ExcelJS.Workbook();
  book.creator = "YacellTech SalesBoard";
  book.created = new Date(report.generatedAt);
  book.calcProperties.fullCalcOnLoad = true;

  const setupSheet = (
    name: string,
    subtitle: string,
    headers: string[],
    widths: number[]
  ) => {
    const sheet = book.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 4, xSplit: 0 }],
    });
    sheet.columns = widths.map((width) => ({ width }));

    // Fila 1: Título Principal
    sheet.mergeCells(1, 1, 1, headers.length);
    sheet.getCell(1, 1).value = `${report.storeName} · ${name} - ${seller.name}`;
    sheet.getCell(1, 1).font = {
      name: "Calibri",
      size: 16,
      bold: true,
      color: { argb: "FF007AFF" },
    };
    sheet.getRow(1).height = 28;

    // Fila 2: Subtítulo
    sheet.mergeCells(2, 1, 2, headers.length);
    sheet.getCell(2, 1).value = `Vendedor: ${seller.name} | Período: Desde ${report.startDate} hasta ${report.endDate}`;
    sheet.getCell(2, 1).font = { size: 11, bold: true, color: { argb: "FF1D1D1F" } };
    sheet.getRow(2).height = 20;

    // Fila 3: Descripción
    sheet.mergeCells(3, 1, 3, headers.length);
    sheet.getCell(3, 1).value = subtitle;
    sheet.getCell(3, 1).alignment = { wrapText: true, vertical: "middle" };
    sheet.getCell(3, 1).font = { size: 9.5, italic: true, color: { argb: "FF666666" } };
    sheet.getRow(3).height = 24;

    // Fila 4: Encabezados de tabla
    sheet.getRow(4).values = headers;
    sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(4).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF007AFF" },
    };
    sheet.getRow(4).alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(4).height = 26;

    sheet.pageSetup = {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
    return sheet;
  };

  // =========================================================================
  // HOJA 1: RESUMEN DEL VENDEDOR
  // =========================================================================
  const summarySheet = setupSheet(
    "Resumen",
    "Resumen consolidado, métricas de rendimiento y estadísticas del vendedor en el período.",
    ["Concepto / Indicador", "Valor", "Detalle"],
    [32, 24, 42]
  );

  const daysWithPoints = report.days.filter((d) => (d.points[seller.id] ?? 0) > 0);
  const daysZero = report.days.filter((d) => d.points[seller.id] === 0);
  const daysNoRecord = report.days.filter((d) => d.points[seller.id] === null);
  const avgActive =
    daysWithPoints.length > 0 ? seller.total / daysWithPoints.length : 0;

  let bestDay: { date: string; pts: number } | null = null;
  for (const d of report.days) {
    const pts = d.points[seller.id];
    if (pts !== null && pts !== undefined && pts > 0) {
      if (!bestDay || pts > bestDay.pts) {
        bestDay = { date: d.date, pts };
      }
    }
  }

  summarySheet.addRow(["Nombre del Vendedor", seller.name, seller.active ? "Vendedor activo" : "Vendedor inactivo"]);
  summarySheet.addRow(["Estado en el sistema", seller.active ? "Activo" : "Inactivo", ""]);
  summarySheet.addRow(["Período consultado", `Desde ${report.startDate} hasta ${report.endDate}`, `${report.days.length} día(s) en total`]);
  const totalSummaryRow = summarySheet.addRow(["TOTAL PUNTOS ACUMULADOS", seller.total, "Suma de todos los puntos del período"]);
  summarySheet.addRow(["Días con puntos registrados (> 0)", daysWithPoints.length, `${((daysWithPoints.length / (report.days.length || 1)) * 100).toFixed(1)}% de los días del período`]);
  summarySheet.addRow(["Días en cero (0 pts)", daysZero.length, "Días con registro guardado en 0"]);
  summarySheet.addRow(["Días sin registro", daysNoRecord.length, "Días sin asignación guardada"]);
  summarySheet.addRow(["Promedio por día con puntos", Number(avgActive.toFixed(1)), "Promedio en días con puntos mayores a cero"]);
  summarySheet.addRow([
    "Mejor día del período",
    bestDay ? bestDay.pts : 0,
    bestDay ? `${bestDay.date} (${getDayOfWeekEs(bestDay.date)}): +${bestDay.pts} pts` : "Sin días con puntos",
  ]);

  // Estilo destacado de la fila de total (Fila 8)
  totalSummaryRow.font = { bold: true, size: 12, color: { argb: "FF007AFF" } };
  totalSummaryRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F7FF" } };

  summarySheet.getCell("B8").numFmt = "#,##0";
  summarySheet.getCell("B9").numFmt = "#,##0";
  summarySheet.getCell("B10").numFmt = "#,##0";
  summarySheet.getCell("B11").numFmt = "#,##0";
  summarySheet.getCell("B12").numFmt = "#,##0.0";
  summarySheet.getCell("B13").numFmt = "#,##0";

  // =========================================================================
  // HOJA 2: DETALLE DIARIO (DÍA A DÍA CON LO QUE SE LE DIO)
  // =========================================================================
  const dailySheet = setupSheet(
    "Detalle diario",
    "Registro cronológico día a día de cuántos puntos se le asignaron cada fecha y su acumulado progresivo.",
    ["Fecha", "Día de la semana", "Puntos del día", "Acumulado progresivo", "Estado del registro"],
    [16, 20, 20, 24, 24]
  );

  let runningSum = 0;
  report.days.forEach((day, idx) => {
    const rowNum = idx + 5;
    const pts = day.points[seller.id];
    if (pts !== null && pts !== undefined) {
      runningSum += pts;
    }
    const estado =
      pts === null || pts === undefined
        ? "Sin registro"
        : pts > 0
        ? `Asignado (+${pts} pts)`
        : "Cero (0 pts)";

    const row = dailySheet.addRow([
      excelDate(day.date),
      getDayOfWeekEs(day.date),
      pts,
      { formula: `SUM($C$5:C${rowNum})`, result: runningSum },
      estado,
    ]);

    if (pts !== null && pts !== undefined && pts > 0) {
      row.getCell(3).font = { bold: true, color: { argb: "FF007AFF" } };
    }
  });

  const lastDailyRow = report.days.length + 4;
  const totalDailyRow = dailySheet.addRow([
    "TOTAL",
    "",
    {
      formula: report.days.length ? `SUM(C5:C${lastDailyRow})` : "0",
      result: seller.total,
    },
    seller.total,
    "Consolidado del período",
  ]);
  totalDailyRow.font = { bold: true, size: 12 };
  totalDailyRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0F7FF" },
  };

  dailySheet.getColumn(1).numFmt = "dd/mm/yyyy";
  dailySheet.getColumn(1).alignment = { horizontal: "center" };
  dailySheet.getColumn(2).alignment = { horizontal: "center" };
  dailySheet.getColumn(3).numFmt = "#,##0";
  dailySheet.getColumn(4).numFmt = "#,##0";
  dailySheet.getColumn(5).alignment = { horizontal: "center" };

  // =========================================================================
  // HOJA 3: MOVIMIENTOS Y AUDITORÍA
  // =========================================================================
  const movementsSheet = setupSheet(
    "Movimientos",
    "Historial de auditoría: registro de sumas, correcciones y aplicaciones para este vendedor.",
    [
      "Fecha de puntos",
      "Operación",
      "Puntos aplicados",
      "Total anterior",
      "Total resultante",
      "Aplicado (Santo Domingo)",
      "Administrador",
    ],
    [18, 18, 20, 18, 18, 28, 34]
  );

  const sellerMovements = report.movements.filter(
    (m) => m.sellerId === seller.id
  );
  const timestamp = new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "short",
    timeStyle: "medium",
  });

  for (const m of sellerMovements) {
    movementsSheet.addRow([
      excelDate(m.date),
      m.type,
      m.points,
      m.previous,
      m.total,
      timestamp.format(new Date(m.appliedAt)),
      m.appliedBy,
    ]);
  }

  movementsSheet.getColumn(1).numFmt = "dd/mm/yyyy";
  movementsSheet.getColumn(1).alignment = { horizontal: "center" };
  movementsSheet.getColumn(2).alignment = { horizontal: "center" };
  [3, 4, 5].forEach((col) => {
    movementsSheet.getColumn(col).numFmt = "#,##0;[Red]-#,##0";
  });

  if (!sellerMovements.length) {
    movementsSheet.addRow([
      "No hay movimientos de auditoría registrados para este vendedor en este rango.",
    ]);
  }

  // Auto-filtros y formato de filas
  for (const sheet of book.worksheets) {
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: {
        row: Math.max(4, sheet.rowCount - (sheet === dailySheet ? 1 : 0)),
        column: sheet.columnCount,
      },
    };
    sheet.eachRow((row, number) => {
      if (number > 4) {
        row.height = 22;
        row.alignment = { vertical: "middle" };
      }
    });
  }

  return book.xlsx.writeBuffer();
}

/**
 * Genera el reporte general en Excel con todos los vendedores:
 * - Resumen
 * - Puntos por día (matriz)
 * - Detalle diario
 * - Movimientos
 */
async function createAllSellersReportExcel(report: PointsReport) {
  const book = new ExcelJS.Workbook();
  book.creator = "YacellTech SalesBoard";
  book.created = new Date(report.generatedAt);
  book.calcProperties.fullCalcOnLoad = true;
  const setup = (name: string, headers: string[], widths: number[]) => {
    const sheet = book.addWorksheet(name, {
      views: [
        {
          state: "frozen",
          ySplit: 4,
          xSplit: name === "Puntos por día" ? 1 : 0,
        },
      ],
    });
    sheet.columns = widths.map((width) => ({ width }));
    sheet.mergeCells(1, 1, 1, headers.length);
    sheet.getCell(1, 1).value = `${report.storeName} · ${name}`;
    sheet.getCell(1, 1).font = {
      name: "Calibri",
      size: 18,
      bold: true,
      color: { argb: "FF007AFF" },
    };
    sheet.getRow(1).height = 30;
    sheet.getCell(2, 1).value = `Desde ${report.startDate} hasta ${report.endDate} (inclusive)`;
    sheet.mergeCells(2, 1, 2, headers.length);
    sheet.mergeCells(3, 1, 3, headers.length);
    sheet.getCell(3, 1).value =
      name === "Movimientos"
        ? HISTORY_NOTE
        : "Las celdas vacías indican que no hay registro; 0 indica un registro guardado con cero puntos.";
    sheet.getCell(3, 1).alignment = { wrapText: true, vertical: "middle" };
    sheet.getRow(3).height = 42;
    sheet.getRow(4).values = headers;
    sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(4).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF007AFF" },
    };
    sheet.getRow(4).height = 28;
    sheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
    return sheet;
  };

  const summary = setup(
    "Resumen",
    ["Vendedor", "Estado actual", "Puntos del período"],
    [28, 18, 24]
  );
  report.sellers.forEach((seller) =>
    summary.addRow([
      seller.name,
      seller.active ? "Activo" : "Inactivo",
      seller.total,
    ])
  );
  const totalRow = summary.addRow([
    "TOTAL",
    null,
    {
      formula: report.sellers.length
        ? `SUM(C5:C${4 + report.sellers.length})`
        : "0",
      result: report.total,
    },
  ]);
  totalRow.font = { bold: true };
  summary.getColumn(3).numFmt = "#,##0";

  const daily = setup(
    "Puntos por día",
    [
      "Fecha",
      ...report.sellers.map((seller) => seller.name),
      "Total del día",
    ],
    [16, ...report.sellers.map(() => 20), 20]
  );
  const totalColumn = report.sellers.length + 2;
  report.days.forEach((day, index) => {
    const row = index + 5;
    daily.addRow([
      excelDate(day.date),
      ...report.sellers.map((seller) => day.points[seller.id]),
      {
        formula: report.sellers.length
          ? `SUM(B${row}:${daily.getColumn(totalColumn - 1).letter}${row})`
          : "0",
        result: day.total,
      },
    ]);
  });
  const dailyTotals = daily.addRow([
    "TOTAL",
    ...report.sellers.map((seller, index) => ({
      formula: `SUM(${daily.getColumn(index + 2).letter}5:${daily.getColumn(index + 2).letter}${report.days.length + 4})`,
      result: seller.total,
    })),
    {
      formula: `SUM(${daily.getColumn(totalColumn).letter}5:${daily.getColumn(totalColumn).letter}${report.days.length + 4})`,
      result: report.total,
    },
  ]);
  dailyTotals.font = { bold: true };
  daily.getColumn(1).numFmt = "dd/mm/yyyy";
  for (let column = 2; column <= totalColumn; column++)
    daily.getColumn(column).numFmt = "#,##0";

  const detail = setup(
    "Detalle diario",
    ["Fecha", "Vendedor", "Puntos del día", "Registro"],
    [16, 28, 20, 20]
  );
  for (const day of report.days)
    for (const seller of report.sellers) {
      const points = day.points[seller.id];
      detail.addRow([
        excelDate(day.date),
        seller.name,
        points,
        points === null ? "Sin registro" : "Guardado",
      ]);
    }
  detail.getColumn(1).numFmt = "dd/mm/yyyy";
  detail.getColumn(3).numFmt = "#,##0";

  const movements = setup(
    "Movimientos",
    [
      "Fecha de puntos",
      "Vendedor",
      "Operación",
      "Puntos aplicados",
      "Total anterior",
      "Total resultante",
      "Aplicado (Santo Domingo)",
      "Administrador",
    ],
    [18, 26, 25, 22, 20, 22, 30, 36]
  );
  const timestamp = new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "short",
    timeStyle: "medium",
  });
  for (const movement of report.movements)
    movements.addRow([
      excelDate(movement.date),
      movement.sellerName,
      movement.type,
      movement.points,
      movement.previous,
      movement.total,
      timestamp.format(new Date(movement.appliedAt)),
      movement.appliedBy,
    ]);
  movements.getColumn(1).numFmt = "dd/mm/yyyy";
  [4, 5, 6].forEach((column) => {
    movements.getColumn(column).numFmt = "#,##0;[Red]-#,##0";
  });
  if (!report.movements.length)
    movements.addRow([
      "No hay movimientos de auditoría disponibles para este rango.",
    ]);
  for (const sheet of book.worksheets) {
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: {
        row: Math.max(
          4,
          sheet.rowCount - (sheet === daily || sheet === summary ? 1 : 0)
        ),
        column: sheet.columnCount,
      },
    };
    sheet.eachRow((row, number) => {
      if (number > 4) {
        row.height = 22;
        row.alignment = { vertical: "middle" };
      }
    });
  }
  return book.xlsx.writeBuffer();
}

export async function createPointsReportExcel(
  report: PointsReport,
  sellerId?: string | null
) {
  if (sellerId && sellerId !== "all") {
    const targetSeller = report.sellers.find((s) => s.id === sellerId);
    if (targetSeller) {
      return createSingleSellerReportExcel(report, targetSeller);
    }
  }
  return createAllSellersReportExcel(report);
}
