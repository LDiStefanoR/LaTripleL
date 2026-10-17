import { existsSync, promises as fs } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { ADDRESS_FULL, BRAND_NAME, PHONE_DISPLAY } from "@/lib/brand";
import { leerAjustesCuenta } from "@/lib/cuentas";
import { datosLocalDesde } from "@/lib/datos-local";

export type LineaPresupuesto = {
  codigo: string;
  nombre: string;
  cantidad: number;
  precio: number;
};

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

async function bufferLogo(ruta: string): Promise<Buffer | null> {
  const limpia = ruta.trim();
  if (!limpia) return null;
  try {
    if (/^https?:\/\//i.test(limpia) || limpia.startsWith("/api/media/")) {
      const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://127.0.0.1:3005";
      const url = limpia.startsWith("http") ? limpia : `${base.replace(/\/$/, "")}${limpia}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    const relativa = limpia.replace(/^\//, "");
    const candidatos = [
      path.join(/* turbopackIgnore: true */ process.cwd(), "public", relativa),
      path.join(/* turbopackIgnore: true */ process.cwd(), relativa),
      path.join(/* turbopackIgnore: true */ process.cwd(), "recursos", "web", path.basename(relativa)),
      path.join(/* turbopackIgnore: true */ process.cwd(), "public", "recursos", "logo.jpg"),
      path.join(/* turbopackIgnore: true */ process.cwd(), "recursos", "logo.jpg"),
    ];
    for (const archivo of candidatos) {
      if (existsSync(archivo)) return await fs.readFile(archivo);
    }
  } catch (error) {
    console.error("[presupuesto] logo", error);
  }
  return null;
}

export async function armarPresupuestoPdf(datos: {
  cliente: string;
  telefono?: string;
  email?: string;
  lineas: LineaPresupuesto[];
  descuento?: number;
}) {
  const ajustes = await leerAjustesCuenta();
  const local = datosLocalDesde({
    nombre: ajustes.nombreLocal,
    mail: ajustes.mailLocal,
    telefono: ajustes.telefonoLocal,
    direccion: ajustes.direccionLocal,
    horarios: ajustes.horariosLocal,
    alias: ajustes.alias,
    cbu: ajustes.cbu,
    titular: ajustes.titular,
    banco: ajustes.banco,
    demoraEntrega: ajustes.demoraEntrega,
    logo: ajustes.logoLocal,
  });
  const logo =
    (await bufferLogo(local.logo)) ||
    (await bufferLogo("/recursos/logo.jpg"));
  const total = datos.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const hoy = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const numero = `P-${Date.now().toString().slice(-8)}`;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: { Title: `Presupuesto ${numero}`, Author: local.nombre || BRAND_NAME },
    });
    const fuente = fuentePdf();
    if (fuente) doc.font(fuente);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const x = 48;
    const ancho = doc.page.width - 96;
    let y = 48;

    if (logo) {
      try {
        doc.image(logo, x, y, { fit: [90, 90] });
      } catch {
        /* sin logo */
      }
    }

    const textoX = logo ? x + 110 : x;
    doc.fontSize(20).fillColor("#111111").text(local.nombre || BRAND_NAME, textoX, y, {
      width: ancho - (logo ? 110 : 0),
    });
    doc.fontSize(11).fillColor("#333333");
    doc.text(local.direccion || ADDRESS_FULL, textoX, y + 28, { width: ancho - 110 });
    doc.text(`Tel. ${local.telefono || PHONE_DISPLAY}`, textoX, y + 44);
    if (local.mail) doc.text(local.mail, textoX, y + 60);

    y = 150;
    doc.fontSize(22).fillColor("#e85d04").text("PRESUPUESTO", x, y);
    doc.fontSize(12).fillColor("#111111").text(`Nº ${numero}`, x + ancho - 140, y, {
      width: 140,
      align: "right",
    });
    y += 28;
    doc.fontSize(11).text(`Fecha: ${hoy}`, x, y);
    y += 18;
    doc.text(`Cliente: ${datos.cliente}`, x, y);
    y += 16;
    if (datos.telefono) {
      doc.text(`Teléfono: ${datos.telefono}`, x, y);
      y += 16;
    }
    if (datos.email) {
      doc.text(`Mail: ${datos.email}`, x, y);
      y += 16;
    }
    if (datos.descuento && datos.descuento > 0) {
      doc.text(`Descuento de ficha: ${datos.descuento}%`, x, y);
      y += 16;
    }

    y += 10;
    doc.moveTo(x, y).lineTo(x + ancho, y).strokeColor("#111111").stroke();
    y += 10;
    doc.fontSize(10).fillColor("#111111");
    doc.text("Cant.", x, y, { width: 40 });
    doc.text("Código", x + 44, y, { width: 70 });
    doc.text("Producto", x + 118, y, { width: ancho - 230 });
    doc.text("P. unit.", x + ancho - 110, y, { width: 50, align: "right" });
    doc.text("Importe", x + ancho - 56, y, { width: 56, align: "right" });
    y += 16;
    doc.moveTo(x, y).lineTo(x + ancho, y).stroke();
    y += 8;

    for (const linea of datos.lineas) {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 48;
      }
      const importe = linea.precio * linea.cantidad;
      doc.text(String(linea.cantidad), x, y, { width: 40 });
      doc.text(linea.codigo || "—", x + 44, y, { width: 70 });
      doc.text(linea.nombre, x + 118, y, { width: ancho - 230 });
      doc.text(pesos(linea.precio), x + ancho - 110, y, { width: 50, align: "right" });
      doc.text(pesos(importe), x + ancho - 56, y, { width: 56, align: "right" });
      y += 18;
    }

    y += 8;
    doc.moveTo(x, y).lineTo(x + ancho, y).stroke();
    y += 14;
    doc.fontSize(14).text("Total", x, y, { width: ancho - 120 });
    doc.text(pesos(total), x + ancho - 120, y, { width: 120, align: "right" });
    y += 28;
    doc.fontSize(9).fillColor("#555555").text(
      "Este presupuesto no es una factura. Los precios pueden cambiar hasta la confirmación de la venta.",
      x,
      y,
      { width: ancho },
    );

    doc.end();
  });
}
