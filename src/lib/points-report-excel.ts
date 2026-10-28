import ExcelJS from "exceljs";
import type { PointsReport } from "@/types/points-report";

const HISTORY_NOTE = "El detalle diario contiene los totales guardados. Movimientos muestra los cambios disponibles en la auditoría; los registros anteriores pueden no tener desglose de cada aplicación.";
const excelDate = (date: string) => new Date(`${date}T00:00:00Z`);

export async function createPointsReportExcel(report: PointsReport) {
  const book = new ExcelJS.Workbook();
  book.creator = "YacellTech SalesBoard";
  book.created = new Date(report.generatedAt);
  book.calcProperties.fullCalcOnLoad = true;
  const setup = (name: string, headers: string[], widths: number[]) => {
    const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4, xSplit: name === "Puntos por día" ? 1 : 0 }] });
    sheet.columns = widths.map((width) => ({ width }));
    sheet.mergeCells(1, 1, 1, headers.length);
    sheet.getCell(1, 1).value = `${report.storeName} · ${name}`;
    sheet.getCell(1, 1).font = { name: "Calibri", size: 18, bold: true, color: { argb: "FF007AFF" } };
    sheet.getRow(1).height = 30;
    sheet.getCell(2, 1).value = `Desde ${report.startDate} hasta ${report.endDate} (inclusive)`;
    sheet.mergeCells(2, 1, 2, headers.length);
    sheet.mergeCells(3, 1, 3, headers.length);
    sheet.getCell(3, 1).value = name === "Movimientos" ? HISTORY_NOTE : "Las celdas vacías indican que no hay registro; 0 indica un registro guardado con cero puntos.";
    sheet.getCell(3, 1).alignment = { wrapText: true, vertical: "middle" };
    sheet.getRow(3).height = 42;
    sheet.getRow(4).values = headers;
    sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF007AFF" } };
    sheet.getRow(4).height = 28;
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return sheet;
  };
  const summary = setup("Resumen", ["Vendedor", "Estado actual", "Puntos del período", "ID vendedor"], [28, 18, 24, 40]);
  report.sellers.forEach((seller) => summary.addRow([seller.name, seller.active ? "Activo" : "Inactivo", seller.total, seller.id]));
  const totalRow = summary.addRow(["TOTAL", null, { formula: report.sellers.length ? `SUM(C5:C${4 + report.sellers.length})` : "0", result: report.total }]);
  totalRow.font = { bold: true };
  summary.getColumn(3).numFmt = "#,##0";

  const daily = setup("Puntos por día", ["Fecha", ...report.sellers.map((seller) => seller.name), "Total del día"], [16, ...report.sellers.map(() => 20), 20]);
  const totalColumn = report.sellers.length + 2;
  report.days.forEach((day, index) => {
    const row = index + 5;
    daily.addRow([excelDate(day.date), ...report.sellers.map((seller) => day.points[seller.id]), {
      formula: report.sellers.length ? `SUM(B${row}:${daily.getColumn(totalColumn - 1).letter}${row})` : "0", result: day.total,
    }]);
  });
  const dailyTotals = daily.addRow(["TOTAL", ...report.sellers.map((seller, index) => ({
    formula: `SUM(${daily.getColumn(index + 2).letter}5:${daily.getColumn(index + 2).letter}${report.days.length + 4})`, result: seller.total,
  })), { formula: `SUM(${daily.getColumn(totalColumn).letter}5:${daily.getColumn(totalColumn).letter}${report.days.length + 4})`, result: report.total }]);
  dailyTotals.font = { bold: true };
  daily.getColumn(1).numFmt = "dd/mm/yyyy";
  for (let column = 2; column <= totalColumn; column++) daily.getColumn(column).numFmt = "#,##0";

  const detail = setup("Detalle diario", ["Fecha", "Vendedor", "Puntos del día", "Registro", "ID vendedor"], [16, 28, 20, 20, 40]);
  for (const day of report.days) for (const seller of report.sellers) {
    const points = day.points[seller.id];
    detail.addRow([excelDate(day.date), seller.name, points, points === null ? "Sin registro" : "Guardado", seller.id]);
  }
  detail.getColumn(1).numFmt = "dd/mm/yyyy";
  detail.getColumn(3).numFmt = "#,##0";

  const movements = setup("Movimientos", ["Fecha de puntos", "Vendedor", "Operación", "Puntos aplicados", "Total anterior", "Total resultante", "Aplicado (Santo Domingo)", "Administrador", "ID vendedor"], [18, 26, 25, 22, 20, 22, 30, 36, 40]);
  const timestamp = new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "short", timeStyle: "medium" });
  for (const movement of report.movements) movements.addRow([
    excelDate(movement.date), movement.sellerName, movement.type, movement.points, movement.previous, movement.total,
    timestamp.format(new Date(movement.appliedAt)), movement.appliedBy, movement.sellerId,
  ]);
  movements.getColumn(1).numFmt = "dd/mm/yyyy";
  [4, 5, 6].forEach((column) => { movements.getColumn(column).numFmt = "#,##0;[Red]-#,##0"; });
  if (!report.movements.length) movements.addRow(["No hay movimientos de auditoría disponibles para este rango."]);
  for (const sheet of book.worksheets) {
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, sheet.rowCount - (sheet === daily || sheet === summary ? 1 : 0)), column: sheet.columnCount } };
    sheet.eachRow((row, number) => { if (number > 4) { row.height = 22; row.alignment = { vertical: "middle" }; } });
  }
  return book.xlsx.writeBuffer();
}
