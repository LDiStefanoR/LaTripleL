import { NextRequest } from "next/server";
import {
  armarExcelCatalogo,
  armarPdfCatalogo,
  filasCatalogo,
  nombreArchivoCatalogo,
} from "@/lib/exportar-catalogo";
import { getSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return new Response("No autorizado", { status: 401 });
  }

  const formato = request.nextUrl.searchParams.get("formato");
  const filas = await filasCatalogo();

  if (formato === "xlsx") {
    const archivo = await armarExcelCatalogo(filas);
    const nombre = nombreArchivoCatalogo("xlsx");
    return new Response(new Uint8Array(archivo), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (formato === "pdf") {
    const archivo = await armarPdfCatalogo(filas);
    const nombre = nombreArchivoCatalogo("pdf");
    return new Response(new Uint8Array(archivo), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response("Formato no válido. Usá formato=xlsx o formato=pdf.", {
    status: 400,
  });
}
