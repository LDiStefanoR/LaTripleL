import { armarFacturaDeuda } from "@/lib/comprobante-caja";
import { ticketParaFactura } from "@/lib/cuentas";
import { interesDeTicket } from "@/lib/deuda";
import { puedeCobrar } from "@/lib/roles";
import { getSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesion();
  if (!sesion || !puedeCobrar(sesion.rol)) {
    return new Response("No autorizado", { status: 401 });
  }
  const { id } = await context.params;
  const encontrado = await ticketParaFactura(id);
  if (!encontrado) return new Response("No encontramos esa deuda.", { status: 404 });
  const { ticket, cliente } = encontrado;
  const interes = interesDeTicket(ticket).interes;
  const pagado = Math.max(0, ticket.total - ticket.debe);
  const numero = ticket.numero?.trim() || ticket.id;
  const archivo = await armarFacturaDeuda({
    numero,
    fecha: ticket.fecha,
    cliente,
    descripcion: ticket.descripcion,
    total: ticket.total,
    pagado,
    debe: ticket.debe,
    interes,
    vencimiento: ticket.vencimiento || "",
    lineas: ticket.lineas ?? [],
  });
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="factura-${numero}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
