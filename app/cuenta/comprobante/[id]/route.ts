import { NextRequest } from "next/server";
import { buscarVentaCaja } from "@/lib/caja";
import { armarFacturaA4, armarTicket } from "@/lib/comprobante-caja";
import { getSesion } from "@/lib/sesion";
import { buscarUsuarioPorEmail } from "@/lib/usuarios";
import { nombreVisible } from "@/lib/venta-texto";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== "cliente") {
    return new Response("No autorizado", { status: 401 });
  }
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!usuario) return new Response("No autorizado", { status: 401 });

  const { id } = await context.params;
  const venta = await buscarVentaCaja(id);
  if (!venta || venta.anulada) return new Response("No encontramos esa venta.", { status: 404 });

  const nombre = nombreVisible({
    nombre: usuario.nombre,
    apellido: usuario.perfil?.apellido,
  })
    .trim()
    .toLowerCase();
  const propia =
    venta.clienteId === usuario.id ||
    (!venta.clienteId && nombre.length > 2 && venta.cliente.trim().toLowerCase() === nombre);
  if (!propia) return new Response("No autorizado", { status: 401 });

  const formato = request.nextUrl.searchParams.get("formato");
  const archivo = formato === "a4" ? await armarFacturaA4(venta) : await armarTicket(venta);
  const estilo = formato === "a4" ? "a4" : "ticket";
  const archivoNombre = `factura-${venta.numero}-${estilo}.pdf`;
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${archivoNombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
