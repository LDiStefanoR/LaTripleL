import { existsSync } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { ADDRESS_FULL, BRAND_NAME, PHONE_DISPLAY } from "@/lib/brand";
import type { VentaCaja } from "@/lib/caja";
import { etiquetaFormaPago, fechaHoraVenta } from "@/lib/venta-texto";

function fuentePdf() {
  const candidatos = [
    path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "arial.ttf"),
    path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "ARIAL.TTF"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ];
  return candidatos.find((archivo) => existsSync(archivo)) ?? null;
}

function pesos(valor: number) {
  return `$${Math.round(valor).toLocaleString("es-AR")}`;
}

function armar(opciones: PDFKit.PDFDocumentOptions, dibujar: (doc: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument(opciones);
    const fuente = fuentePdf();
    if (fuente) doc.font(fuente);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    dibujar(doc);
    doc.end();
  });
}

export function armarFacturaA4(venta: VentaCaja) {
  const { dia, hora } = fechaHoraVenta(venta.creadoEn);
  return armar(
    {
      size: "A4",
      margin: 48,
      info: { Title: `Factura ${venta.numero}`, Author: BRAND_NAME },
    },
    (doc) => {
      const x = 48;
      const ancho = doc.page.width - 96;
      doc.fontSize(22).fillColor("#111111").text(BRAND_NAME, x, 48, { width: ancho });
      doc.fontSize(11).fillColor("#333333").text(ADDRESS_FULL, x, 78);
      doc.text(`Tel. ${PHONE_DISPLAY}`, x, 94);
      doc.fontSize(18).fillColor("#111111").text(`Factura ${venta.numero}`, x, 124);
      if (venta.anulada) {
        doc.fontSize(12).fillColor("#9b1c1c").text("ANULADA", x, 148);
      }
      let y = venta.anulada ? 172 : 156;
      const datos = [
        `Día: ${dia}`,
        `Hora: ${hora}`,
        `Empleado: ${venta.empleado}`,
        `Cliente: ${venta.cliente}`,
        `Forma de pago: ${etiquetaFormaPago(venta.formaPago)}`,
      ];
      doc.fontSize(11).fillColor("#111111");
      for (const linea of datos) {
        doc.text(linea, x, y);
        y += 16;
      }
      y += 10;
      doc.moveTo(x, y).lineTo(x + ancho, y).strokeColor("#111111").stroke();
      y += 8;
      doc.fontSize(10).text("Cant.", x, y, { width: 40 });
      doc.text("Código", x + 44, y, { width: 70 });
      doc.text("Producto", x + 118, y, { width: ancho - 230 });
      doc.text("P. unit.", x + ancho - 110, y, { width: 50, align: "right" });
      doc.text("Importe", x + ancho - 56, y, { width: 56, align: "right" });
      y += 16;
      doc.moveTo(x, y).lineTo(x + ancho, y).stroke();
      y += 8;
      for (const linea of venta.lineas) {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 48;
        }
        const importe = linea.precio * linea.cantidad;
        doc.text(String(linea.cantidad), x, y, { width: 40 });
        doc.text(linea.codigo, x + 44, y, { width: 70 });
        doc.text(linea.nombre, x + 118, y, { width: ancho - 230 });
        doc.text(pesos(linea.precio), x + ancho - 110, y, { width: 50, align: "right" });
        doc.text(pesos(importe), x + ancho - 56, y, { width: 56, align: "right" });
        y += 18;
      }
      y += 6;
      doc.moveTo(x, y).lineTo(x + ancho, y).stroke();
      y += 12;
      doc.fontSize(14).text("Total", x, y, { width: ancho - 120 });
      doc.text(pesos(venta.total), x + ancho - 120, y, { width: 120, align: "right" });
    },
  );
}

export function armarTicket(venta: VentaCaja) {
  const { dia, hora } = fechaHoraVenta(venta.creadoEn);
  const ancho = 226;
  const alto = 250 + venta.lineas.length * 32;
  return armar(
    {
      size: [ancho, alto],
      margin: 12,
      info: { Title: `Ticket ${venta.numero}`, Author: BRAND_NAME },
    },
    (doc) => {
      const x = 12;
      const w = ancho - 24;
      const centro = { width: w, align: "center" as const };
      doc.fontSize(14).fillColor("#111111").text(BRAND_NAME, x, 16, centro);
      doc.fontSize(8).text(ADDRESS_FULL, x, 36, centro);
      doc.text(`Tel. ${PHONE_DISPLAY}`, x, 48, centro);
      doc.fontSize(9).text("--------------------------------", x, 64, centro);
      doc.fontSize(12).text(`Factura ${venta.numero}`, x, 80, centro);
      if (venta.anulada) doc.fontSize(10).text("ANULADA", x, 96, centro);
      let y = venta.anulada ? 114 : 100;
      doc.fontSize(8);
      const filas = [
        `${dia}  ${hora}`,
        `Empleado: ${venta.empleado}`,
        `Cliente: ${venta.cliente}`,
        `Pago: ${etiquetaFormaPago(venta.formaPago)}`,
      ];
      for (const fila of filas) {
        doc.text(fila, x, y, { width: w });
        y += 12;
      }
      y += 4;
      doc.text("--------------------------------", x, y, centro);
      y += 16;
      for (const linea of venta.lineas) {
        doc.fontSize(8).text(`${linea.cantidad} x ${linea.nombre}`, x, y, { width: w });
        y += 11;
        doc.text(pesos(linea.precio * linea.cantidad), x, y, { width: w, align: "right" });
        y += 14;
      }
      doc.text("--------------------------------", x, y, centro);
      y += 16;
      doc.fontSize(12).text(`TOTAL  ${pesos(venta.total)}`, x, y, centro);
      y += 22;
      doc.fontSize(8).text("Gracias por su compra", x, y, centro);
    },
  );
}

export function armarFacturaDeuda(datos: {
  numero: string;
  fecha: string;
  cliente: string;
  descripcion: string;
  total: number;
  pagado: number;
  debe: number;
  interes: number;
  vencimiento: string;
  lineas: { nombre: string; codigo?: string; monto?: number }[];
}) {
  return armar(
    {
      size: "A4",
      margin: 48,
      info: { Title: `Factura ${datos.numero}`, Author: BRAND_NAME },
    },
    (doc) => {
      const x = 48;
      const ancho = doc.page.width - 96;
      doc.fontSize(22).fillColor("#111111").text(BRAND_NAME, x, 48, { width: ancho });
      doc.fontSize(11).fillColor("#333333").text(ADDRESS_FULL, x, 78);
      doc.text(`Tel. ${PHONE_DISPLAY}`, x, 94);
      doc.fontSize(18).fillColor("#111111").text(`Factura ${datos.numero}`, x, 124);
      let y = 156;
      const filas = [
        `Fecha: ${datos.fecha}`,
        `Cliente: ${datos.cliente}`,
        `Concepto: ${datos.descripcion}`,
        datos.vencimiento ? `Vencimiento: ${datos.vencimiento}` : "",
      ].filter(Boolean);
      doc.fontSize(11).fillColor("#111111");
      for (const fila of filas) {
        doc.text(fila, x, y);
        y += 16;
      }
      y += 8;
      doc.moveTo(x, y).lineTo(x + ancho, y).strokeColor("#111111").stroke();
      y += 10;
      if (datos.lineas.length === 0) {
        doc.text(datos.descripcion || "Deuda", x, y, { width: ancho - 80 });
        doc.text(pesos(datos.total), x + ancho - 80, y, { width: 80, align: "right" });
        y += 20;
      } else {
        for (const linea of datos.lineas) {
          doc.text(linea.codigo || "", x, y, { width: 70 });
          doc.text(linea.nombre, x + 76, y, { width: ancho - 170 });
          doc.text(pesos(linea.monto ?? 0), x + ancho - 80, y, { width: 80, align: "right" });
          y += 18;
        }
      }
      y += 6;
      doc.moveTo(x, y).lineTo(x + ancho, y).stroke();
      y += 14;
      const totales = [
        ["Importe", datos.total],
        ["Pagado", datos.pagado],
        ["Queda", datos.debe],
        ["Mora", datos.interes],
        ["A cobrar", datos.debe + datos.interes],
      ] as const;
      for (const [etiqueta, valor] of totales) {
        doc.fontSize(etiqueta === "A cobrar" ? 14 : 11).text(etiqueta, x, y, { width: ancho - 120 });
        doc.text(pesos(valor), x + ancho - 120, y, { width: 120, align: "right" });
        y += etiqueta === "A cobrar" ? 22 : 16;
      }
    },
  );
}
