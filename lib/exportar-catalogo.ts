import { existsSync, promises as fs } from "fs";
import path from "path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { leerAjustes } from "@/lib/ajustes";
import { BRAND_NAME } from "@/lib/brand";
import { formatoPesos, nombreVitrina } from "@/lib/format";
import {
  descuentoClienteDe,
  precioConDescuentoCliente,
  precioLista,
} from "@/lib/precios";
import { leerProductos } from "@/lib/productos";
import { leerRubros } from "@/lib/rubros";

export type FilaCatalogo = {
  codigo: string;
  nombre: string;
  rubro: string;
  imagen: string;
  minorista: number;
  mayorista: number;
};

type ImagenArchivo = { buffer: Buffer; extension: "jpeg" | "png" | "gif" };

export async function filasCatalogo(): Promise<FilaCatalogo[]> {
  const productos = await leerProductos();
  const ajustes = await leerAjustes();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  const etiqueta = Object.fromEntries(rubros.map((r) => [r.clave, r.etiqueta]));

  return productos
    .map((producto) => {
      const minorista = precioLista(producto, ajustes);
      const dto = descuentoClienteDe(producto.seccion, ajustes);
      return {
        codigo: producto.codigo,
        nombre: nombreVitrina(producto.nombre),
        rubro: etiqueta[producto.seccion] ?? producto.seccion,
        imagen: producto.imagen,
        minorista,
        mayorista: precioConDescuentoCliente(minorista, dto),
      };
    })
    .sort((a, b) => {
      const rubro = a.rubro.localeCompare(b.rubro, "es");
      if (rubro !== 0) return rubro;
      return a.nombre.localeCompare(b.nombre, "es");
    });
}

function candidatosImagen(imagen: string) {
  const limpio = imagen.replace(/^\/+/, "").replace(/\\/g, "/");
  const nombre = path.basename(limpio);
  return [
    path.join(process.cwd(), "public", limpio),
    path.join(process.cwd(), limpio),
    path.join(process.cwd(), "public", "recursos", "imagenes-productos", nombre),
    path.join(process.cwd(), "recursos", "imagenes-productos", nombre),
  ];
}

function extensionImagen(archivo: string): ImagenArchivo["extension"] | null {
  const ext = path.extname(archivo).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "jpeg";
  if (ext === ".png") return "png";
  if (ext === ".gif") return "gif";
  return null;
}

async function leerImagen(imagen: string): Promise<ImagenArchivo | null> {
  const extension = extensionImagen(imagen);
  if (!extension) return null;
  for (const candidato of candidatosImagen(imagen)) {
    try {
      const buffer = await fs.readFile(candidato);
      if (buffer.length > 0) return { buffer, extension };
    } catch {
      /* siguiente */
    }
  }
  return null;
}

async function cacheImagenes(filas: FilaCatalogo[]) {
  const cache = new Map<string, ImagenArchivo | null>();
  for (const fila of filas) {
    if (cache.has(fila.imagen)) continue;
    cache.set(fila.imagen, await leerImagen(fila.imagen));
  }
  return cache;
}

function fuentePdf(): string | null {
  const candidatos = [
    path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "arial.ttf"),
    path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "ARIAL.TTF"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ];
  return candidatos.find((archivo) => existsSync(archivo)) ?? null;
}

export async function armarExcelCatalogo(filas: FilaCatalogo[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND_NAME;
  workbook.created = new Date();
  const hoja = workbook.addWorksheet("Catálogo", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  hoja.columns = [
    { header: "Foto", key: "foto", width: 12 },
    { header: "Código", key: "codigo", width: 12 },
    { header: "Rubro", key: "rubro", width: 22 },
    { header: "Nombre", key: "nombre", width: 52 },
    { header: "Precio minorista", key: "minorista", width: 18 },
    { header: "Precio mayorista", key: "mayorista", width: 18 },
  ];

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B5FE0" },
  };
  encabezado.alignment = { vertical: "middle" };
  encabezado.height = 22;

  const imagenes = await cacheImagenes(filas);

  filas.forEach((fila, index) => {
    const row = hoja.addRow({
      foto: "",
      codigo: fila.codigo,
      rubro: fila.rubro,
      nombre: fila.nombre,
      minorista: fila.minorista,
      mayorista: fila.mayorista,
    });
    row.height = 48;
    row.alignment = { vertical: "middle", wrapText: true };
    row.getCell("minorista").numFmt = '"$"#,##0';
    row.getCell("mayorista").numFmt = '"$"#,##0';

    const archivo = imagenes.get(fila.imagen);
    if (!archivo) return;
    const imageId = workbook.addImage({
      buffer: Buffer.from(archivo.buffer) as unknown as ExcelJS.Buffer,
      extension: archivo.extension,
    });
    hoja.addImage(imageId, {
      tl: { col: 0.08, row: index + 1.08 },
      ext: { width: 50, height: 50 },
      editAs: "oneCell",
    } as ExcelJS.ImagePosition);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function armarPdfCatalogo(filas: FilaCatalogo[]) {
  const imagenes = await cacheImagenes(filas);
  const fuente = fuentePdf();

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 36,
      info: {
        Title: `Catálogo de precios ${BRAND_NAME}`,
        Author: BRAND_NAME,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (fuente) doc.font(fuente);

    const margen = 36;
    const ancho = doc.page.width - margen * 2;
    const altoPagina = doc.page.height;
    const pie = 28;
    const altoFila = 48;
    const cols = {
      foto: margen,
      codigo: margen + 52,
      rubro: margen + 108,
      nombre: margen + 198,
      minorista: margen + ancho - 150,
      mayorista: margen + ancho - 72,
    };

    function encabezadoPagina() {
      doc.fontSize(16).fillColor("#071A4A").text(`Catálogo de precios ${BRAND_NAME}`, margen, 28, {
        width: ancho,
      });
      doc
        .fontSize(9)
        .fillColor("#555555")
        .text(
          `Minorista: precio de lista. Mayorista: precio con descuento de cliente registrado. ${new Date().toLocaleDateString("es-AR")}`,
          margen,
          48,
          { width: ancho },
        );
      const y = 68;
      doc.rect(margen, y, ancho, 18).fill("#1B5FE0");
      doc.fillColor("#FFFFFF").fontSize(8);
      doc.text("Foto", cols.foto + 4, y + 5, { width: 40 });
      doc.text("Cód.", cols.codigo, y + 5, { width: 50 });
      doc.text("Rubro", cols.rubro, y + 5, { width: 84 });
      doc.text("Nombre", cols.nombre, y + 5, { width: 210 });
      doc.text("Minorista", cols.minorista, y + 5, { width: 70, align: "right" });
      doc.text("Mayorista", cols.mayorista, y + 5, { width: 70, align: "right" });
      return y + 22;
    }

    let y = encabezadoPagina();

    for (const fila of filas) {
      if (y + altoFila > altoPagina - pie) {
        doc.addPage();
        if (fuente) doc.font(fuente);
        y = encabezadoPagina();
      }

      doc
        .moveTo(margen, y + altoFila)
        .lineTo(margen + ancho, y + altoFila)
        .strokeColor("#E5E7EB")
        .lineWidth(0.5)
        .stroke();

      const archivo = imagenes.get(fila.imagen);
      if (archivo) {
        try {
          doc.image(Buffer.from(archivo.buffer), cols.foto + 2, y + 4, {
            fit: [40, 40],
            align: "center",
            valign: "center",
          });
        } catch {
          /* sin foto */
        }
      }

      doc.fillColor("#111111").fontSize(8);
      doc.text(fila.codigo, cols.codigo, y + 16, { width: 50 });
      doc.text(fila.rubro, cols.rubro, y + 16, { width: 84 });
      doc.text(fila.nombre, cols.nombre, y + 10, { width: 210, height: 32 });
      doc.text(formatoPesos(fila.minorista), cols.minorista, y + 16, {
        width: 70,
        align: "right",
      });
      doc.fillColor("#0C3A9A").text(formatoPesos(fila.mayorista), cols.mayorista, y + 16, {
        width: 70,
        align: "right",
      });

      y += altoFila;
    }

    doc.end();
  });
}

export function nombreArchivoCatalogo(ext: "xlsx" | "pdf") {
  const fecha = new Date().toISOString().slice(0, 10);
  return `LaTripleL-catalogo-precios-${fecha}.${ext}`;
}
