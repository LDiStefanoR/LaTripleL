import { NextRequest } from "next/server";
import { leerPedidosProveedor, recibidoDeLinea } from "@/lib/deposito";
import { formatoPesos, nombreVitrina } from "@/lib/format";
import { leerProductos } from "@/lib/productos";
import { puedeCobrar } from "@/lib/roles";
import { leerRubros } from "@/lib/rubros";
import { getSesion } from "@/lib/sesion";
import { armarTablaExcel } from "@/lib/tabla-excel";
import { armarTablaPdf } from "@/lib/tabla-pdf";

export const dynamic = "force-dynamic";

const COLUMNAS_PDF = ["Código", "Producto", "Cantidad", "Último costo"];
const COLUMNAS_EXCEL = [
  "Código",
  "Producto",
  "Sección",
  "Stock",
  "Mínimo",
  "Cantidad",
  "Recibido",
  "Último costo",
  "Precio",
  "Códigos de barra",
];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesion();
  if (!sesion || !puedeCobrar(sesion.rol)) {
    return new Response("No autorizado", { status: 401 });
  }
  const { id } = await context.params;
  const [pedidos, productos] = await Promise.all([leerPedidosProveedor(), leerProductos()]);
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) return new Response("No encontramos ese pedido.", { status: 404 });
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  const etiqueta = Object.fromEntries(rubros.map((r) => [r.clave, r.etiqueta]));

  const filasPdf = pedido.lineas.map((linea) => {
    const producto = productos.find((p) => p.id === linea.productoId);
    const costo = typeof producto?.costo === "number" ? producto.costo : linea.costo;
    return [
      linea.codigo,
      nombreVitrina(linea.nombre),
      String(linea.cantidad),
      typeof costo === "number" ? formatoPesos(costo) : "—",
    ];
  });
  const filasExcel = pedido.lineas.map((linea) => {
    const producto = productos.find((p) => p.id === linea.productoId);
    const costo = typeof producto?.costo === "number" ? producto.costo : linea.costo;
    return [
      linea.codigo,
      nombreVitrina(linea.nombre),
      producto ? (etiqueta[producto.seccion] ?? producto.seccion) : "—",
      typeof producto?.stock === "number" ? String(producto.stock) : "Sin control",
      typeof producto?.stockMinimo === "number" ? String(producto.stockMinimo) : "—",
      String(linea.cantidad),
      String(recibidoDeLinea(linea, pedido.estado)),
      typeof costo === "number" ? String(costo) : "",
      typeof producto?.precio === "number" ? String(producto.precio) : "",
      (producto?.codigosBarra ?? []).join(", "),
    ];
  });
  const titulo = `Pedido ${pedido.numero} · ${pedido.proveedorNombre}`;
  const formato = request.nextUrl.searchParams.get("formato");
  if (formato === "xlsx") {
    const archivo = await armarTablaExcel({ titulo, columnas: COLUMNAS_EXCEL, filas: filasExcel });
    return new Response(new Uint8Array(archivo), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="pedido-${pedido.numero}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const archivo = await armarTablaPdf({
    titulo,
    detalle: "Pedido al proveedor",
    columnas: COLUMNAS_PDF,
    filas: filasPdf,
  });
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pedido-${pedido.numero}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
