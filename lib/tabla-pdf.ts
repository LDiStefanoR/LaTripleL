import { existsSync } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { ADDRESS_LINE, BRAND_NAME } from "@/lib/brand";

function fuentePdf() {
  const candidatos = [
    path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "arial.ttf"),
    path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "ARIAL.TTF"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ];
  return candidatos.find((archivo) => existsSync(archivo)) ?? null;
}

export function armarTablaPdf(datos: {
  titulo: string;
  detalle?: string;
  columnas: string[];
  filas: string[][];
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 32,
      info: { Title: datos.titulo, Author: BRAND_NAME },
    });
    const fuente = fuentePdf();
    if (fuente) doc.font(fuente);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const margen = 32;
    const ancho = doc.page.width - margen * 2;
    const alto = doc.page.height;
    const col = ancho / Math.max(1, datos.columnas.length);
    const altoFila = 18;

    function encabezado() {
      doc.fillColor("#0a0a0a").fontSize(16).text(BRAND_NAME, margen, 28, { width: ancho });
      doc.fontSize(12).fillColor("#c2410c").text(datos.titulo, margen, 48, { width: ancho });
      doc
        .fontSize(8)
        .fillColor("#525252")
        .text(
          [ADDRESS_LINE, datos.detalle, new Date().toLocaleString("es-AR")].filter(Boolean).join(" · "),
          margen,
          66,
          { width: ancho },
        );
      const y = 84;
      doc.rect(margen, y, ancho, altoFila).fill("#0a0a0a");
      doc.fillColor("#ffffff").fontSize(8);
      datos.columnas.forEach((columna, i) => {
        doc.text(columna, margen + i * col + 4, y + 5, { width: col - 8, ellipsis: true });
      });
      return y + altoFila;
    }

    let y = encabezado();
    datos.filas.forEach((fila, indice) => {
      if (y + altoFila > alto - 36) {
        doc.addPage();
        if (fuente) doc.font(fuente);
        y = encabezado();
      }
      if (indice % 2 === 0) doc.rect(margen, y, ancho, altoFila).fill("#fff8ef");
      doc.fillColor("#0a0a0a").fontSize(8);
      fila.forEach((celda, i) => {
        doc.text(celda, margen + i * col + 4, y + 5, { width: col - 8, ellipsis: true });
      });
      y += altoFila;
    });
    if (datos.filas.length === 0) {
      doc.fillColor("#525252").fontSize(10).text("No hay filas para este listado.", margen, y + 12);
    }
    doc.end();
  });
}
