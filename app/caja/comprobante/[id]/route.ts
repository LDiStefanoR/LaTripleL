import { NextRequest } from "next/server";
import { buscarVentaCaja } from "@/lib/caja";
import { armarFacturaA4, armarTicket } from "@/lib/comprobante-caja";
import { puedeCobrar } from "@/lib/roles";
import { getSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesion();
  if (!sesion || !puedeCobrar(sesion.rol)) {
    return new Response("No autorizado", { status: 401 });
  }
  const { id } = await context.params;
  const venta = await buscarVentaCaja(id);
  if (!venta) return new Response("No encontramos esa venta.", { status: 404 });

  const formato = request.nextUrl.searchParams.get("formato");
  const archivo = formato === "ticket" ? await armarTicket(venta) : await armarFacturaA4(venta);
  const estilo = formato === "ticket" ? "ticket" : "a4";
  const nombre = `factura-${venta.numero}-${estilo}.pdf`;
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
