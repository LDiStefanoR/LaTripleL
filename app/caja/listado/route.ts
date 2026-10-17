import { NextRequest } from "next/server";
import { leerAjustes } from "@/lib/ajustes";
import { leerVentasCaja } from "@/lib/caja";
import { leerComprobantesCompra } from "@/lib/deposito";
import { leerRetirosCaja } from "@/lib/retiros-caja";
import { leerCuentas } from "@/lib/cuentas";
import { interesDeTicket } from "@/lib/deuda";
import { politicaDeCliente } from "@/lib/politica-cliente";
import { armarListado, esTipoListado } from "@/lib/listados";
import { precioLista } from "@/lib/precios";
import { leerProductos } from "@/lib/productos";
import { exigirPermisoCaja } from "@/lib/exigir-permiso";
import { puedeCobrar } from "@/lib/roles";
import { leerRubros } from "@/lib/rubros";
import { getSesion } from "@/lib/sesion";
import { armarTablaExcel } from "@/lib/tabla-excel";
import { armarTablaPdf } from "@/lib/tabla-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sesion = await getSesion();
  if (!sesion || !puedeCobrar(sesion.rol) || !(await exigirPermisoCaja("listados"))) {
    return new Response("No autorizado", { status: 401 });
  }
  const tipo = request.nextUrl.searchParams.get("tipo") ?? "";
  if (!esTipoListado(tipo)) return new Response("Elegí un listado.", { status: 400 });

  const [ajustes, productos, ventas, cuentas, comprobantes, retiros] = await Promise.all([
    leerAjustes(),
    leerProductos(),
    leerVentasCaja(),
    leerCuentas(),
    leerComprobantesCompra(),
    leerRetirosCaja(),
  ]);
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  const etiqueta = Object.fromEntries(rubros.map((r) => [r.clave, r.etiqueta]));
  const tabla = armarListado(
    tipo,
    {
      productos: productos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        seccion: p.seccion,
        precio: precioLista(p, ajustes),
        stock: typeof p.stock === "number" ? p.stock : null,
        stockMinimo: typeof p.stockMinimo === "number" ? p.stockMinimo : null,
        costo: typeof p.costo === "number" ? p.costo : null,
      })),
      ventas,
      deudas: cuentas.clientes
        .map((cliente) => {
          const tickets = cuentas.tickets.filter(
            (t) => t.clienteId === cliente.id && t.estado === "vigente" && t.debe > 0,
          );
          const politica = politicaDeCliente(cliente, ajustes);
          const interes = tickets.reduce(
            (suma, ticket) => suma + interesDeTicket(ticket, undefined, politica).interes,
            0,
          );
          const semanas = tickets.reduce(
            (max, ticket) => Math.max(max, interesDeTicket(ticket, undefined, politica).semanas),
            0,
          );
          return {
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            debe: tickets.reduce((suma, t) => suma + t.debe, 0),
            interes,
            semanas,
          };
        })
        .filter((d) => d.debe > 0),
      etiqueta,
      comprobantes: comprobantes.map((c) => ({
        numero: c.numero,
        fecha: c.fecha,
        proveedorNombre: c.proveedorNombre,
        origen: c.origen,
        articulos: c.lineas.length,
        total: c.total,
      })),
      retiros,
    },
    {
      desde: request.nextUrl.searchParams.get("desde") ?? "",
      hasta: request.nextUrl.searchParams.get("hasta") ?? "",
      q: request.nextUrl.searchParams.get("q") ?? "",
    },
  );
  const formato = request.nextUrl.searchParams.get("formato");
  if (formato === "xlsx") {
    const archivo = await armarTablaExcel({
      titulo: tabla.titulo,
      columnas: tabla.columnas,
      filas: tabla.filas,
    });
    return new Response(new Uint8Array(archivo), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${tipo}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const archivo = await armarTablaPdf({
    titulo: tabla.titulo,
    detalle: "Listado de caja",
    columnas: tabla.columnas,
    filas: tabla.filas,
  });
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${tipo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
