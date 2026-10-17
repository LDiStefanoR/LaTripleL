import ExcelJS from "exceljs";
import { BRAND_NAME } from "@/lib/brand";

export async function armarTablaExcel(datos: {
  titulo: string;
  columnas: string[];
  filas: string[][];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND_NAME;
  const hoja = workbook.addWorksheet(datos.titulo.slice(0, 31) || "Listado");
  hoja.addRow([BRAND_NAME]);
  hoja.addRow([datos.titulo]);
  hoja.addRow([]);
  const cabecera = hoja.addRow(datos.columnas);
  cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecera.eachCell((celda) => {
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0A" } };
  });
  for (const fila of datos.filas) hoja.addRow(fila);
  hoja.columns.forEach((columna) => {
    columna.width = 18;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
