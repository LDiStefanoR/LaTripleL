import { formatoPesos } from "@/lib/format";
import { costoEnvio, etiquetaCostoEnvio } from "@/lib/envio";
import type { EscalaEnvio } from "@/types/ajustes";
import { resumenCombosEnCarrito, totalConCombos } from "@/lib/combo";
import { totalLineaConPromo } from "@/lib/oferta";
import { textoEntrega } from "@/lib/reparto";
import {
  ETIQUETA_SI_FALTA,
  type FranjaReparto,
  type ModoEntrega,
  type SiFaltaProducto,
} from "@/types/pedido";
import type { ComboPromo, TipoOferta } from "@/types/promo";

export const CARRITO_STORAGE_KEY = "latriplel-carrito";
export const ID_LINEA_ENVIO = "__envio";

export type LineaCarrito = {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  precioLista?: number;
  descuentoCliente?: number;
  tipoPromo?: TipoOferta;
  cantidad: number;
  /** Tope que viene del stock de caja. Sin número, el catálogo no limita la cantidad. */
  stock?: number;
};

export function esLineaEnvio(linea: { id?: string; codigo?: string }) {
  return linea.id === ID_LINEA_ENVIO || linea.codigo === "ENVIO";
}

export function lineasProducto(lineas: LineaCarrito[]) {
  return lineas.filter((linea) => !esLineaEnvio(linea));
}

export function totalCarrito(lineas: LineaCarrito[], combos: ComboPromo[] = []) {
  return totalConCombos(lineas, combos);
}

export function subtotalProductos(lineas: LineaCarrito[], combos: ComboPromo[] = []) {
  return totalCarrito(lineasProducto(lineas), combos);
}

export function cantidadTotal(lineas: LineaCarrito[]) {
  return lineasProducto(lineas).reduce((suma, linea) => suma + linea.cantidad, 0);
}

export function lineaEnvio(costo: number): LineaCarrito {
  return {
    id: ID_LINEA_ENVIO,
    codigo: "ENVIO",
    nombre: etiquetaCostoEnvio(costo),
    precio: costo,
    cantidad: 1,
  };
}

export function armarLineasPedido(
  lineas: LineaCarrito[],
  combos: ComboPromo[] = [],
  escala?: EscalaEnvio,
) {
  const productos = lineasProducto(lineas);
  const costo = costoEnvio(totalCarrito(productos, combos), escala);
  return [...productos, lineaEnvio(costo)];
}

export function mensajePedidoWhatsApp(
  lineas: LineaCarrito[],
  opciones?: {
    clienteRegistrado?: boolean;
    contacto?: {
      nombre?: string;
      email?: string;
      telefono?: string;
      direccion?: string;
      horarios?: string;
    };
    franjaReparto?: FranjaReparto;
    siFaltaProducto?: SiFaltaProducto;
    modoEntrega?: ModoEntrega;
    fechaEntrega?: string;
    combos?: ComboPromo[];
    envio?: EscalaEnvio;
  },
) {
  const combos = opciones?.combos ?? [];
  const armadas = armarLineasPedido(lineas, combos, opciones?.envio);
  const productos = lineasProducto(armadas);
  const envio = armadas.find(esLineaEnvio);
  const resumen = resumenCombosEnCarrito(productos, combos);
  const items = productos
    .map((linea) => {
      const neto =
        resumen.porLinea.get(linea.id)?.neto ??
        totalLineaConPromo(linea.cantidad, linea.precio, linea.tipoPromo);
      const extra =
        linea.tipoPromo === "2x1" || linea.tipoPromo === "3x2"
          ? ` (${linea.tipoPromo})`
          : (resumen.porLinea.get(linea.id)?.setsCombo ?? 0) > 0
            ? " (combo)"
            : "";
      return `• ${linea.cantidad} x ${linea.nombre} (cód. ${linea.codigo}) — ${formatoPesos(neto)}${extra}`;
    })
    .join("\n");
  const subtotal = totalCarrito(productos, combos);
  const costo = envio?.precio ?? 0;
  const c = opciones?.contacto;
  const datos = [
    c?.nombre ? `Nombre: ${c.nombre}` : "",
    c?.email ? `Mail: ${c.email}` : "",
    c?.telefono ? `Teléfono: ${c.telefono}` : "",
    c?.direccion ? `Dirección: ${c.direccion}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const cliente = opciones?.clienteRegistrado
    ? "\nSoy cliente registrado; estos son mis precios con descuento."
    : "";
  const bloqueDatos = datos ? `\n\nDatos de contacto:\n${datos}` : "";
  const entrega =
    opciones?.modoEntrega && opciones.fechaEntrega && opciones.franjaReparto
      ? `\nEntrega: ${textoEntrega(opciones.modoEntrega, opciones.fechaEntrega, opciones.franjaReparto)}`
      : "";
  const siFalta = opciones?.siFaltaProducto
    ? `\nSi falta un producto: ${ETIQUETA_SI_FALTA[opciones.siFaltaProducto]}`
    : "";
  const bloqueEnvio = `\nEnvío: ${costo > 0 ? formatoPesos(costo) : "sin cargo"}\nTotal estimado: ${formatoPesos(subtotal + costo)}`;
  return `Hola La Triple L, quiero hacer este pedido:\n\n${items}\n\nProductos: ${formatoPesos(subtotal)}${bloqueEnvio}${cliente}${bloqueDatos}${entrega}${siFalta}\n\n¿Me confirman el envío a Rosario?`;
}
