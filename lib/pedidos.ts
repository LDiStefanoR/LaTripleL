import { randomUUID } from "crypto";
import { armarLineasPedido, lineasProducto, totalCarrito, type LineaCarrito } from "@/lib/carrito";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { combosActivos } from "@/lib/promos";
import type {
  ContactoPedido,
  EstadoPedido,
  FranjaReparto,
  ModoEntrega,
  Pedido,
  SiFaltaProducto,
} from "@/types/pedido";
import { textoEntrega, turnoValido } from "@/lib/reparto";
import { normalizarEmailLogin } from "@/lib/auth-config";

async function leerArchivo(): Promise<Pedido[]> {
  const parsed = await leerJsonData<Pedido[]>("pedidos.json", []);
  return Array.isArray(parsed) ? parsed : [];
}

async function escribirArchivo(pedidos: Pedido[]) {
  await escribirJsonData("pedidos.json", pedidos);
}

export async function listarPedidos() {
  const pedidos = await leerArchivo();
  return pedidos.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export function validarContacto(contacto: ContactoPedido) {
  if (contacto.nombre.trim().length < 2) return "Ingresá un nombre.";
  if (!contacto.email.includes("@")) return "Ingresá un mail válido.";
  if (contacto.telefono.replace(/\D/g, "").length < 8) {
    return "Ingresá un teléfono válido.";
  }
  if (contacto.direccion.trim().length < 5) return "Ingresá una dirección.";
  return null;
}

export function validarOpcionesEntrega(
  franja: string,
  siFalta: string,
  fechaEntrega?: string,
): string | null {
  if (franja !== "manana" && franja !== "tarde") {
    return "Elegí si el reparto es de mañana (9 a 13) o de tarde (18 a 20).";
  }
  if (siFalta !== "reemplazo_misma_marca" && siFalta !== "omitir") {
    return "Elegí qué hacemos si no hay stock de algún producto.";
  }
  if (!fechaEntrega || !turnoValido(fechaEntrega, franja)) {
    return "Elegí un día y una franja en los que el local esté abierto.";
  }
  return null;
}

export async function crearPedido(datos: {
  lineas: LineaCarrito[];
  contacto: ContactoPedido;
  franjaReparto: FranjaReparto;
  siFaltaProducto: SiFaltaProducto;
  modoEntrega: ModoEntrega;
  fechaEntrega: string;
  clienteRegistrado: boolean;
  usuarioId?: string;
}) {
  if (lineasProducto(datos.lineas).length === 0) {
    return { error: "El pedido está vacío." as const };
  }
  const errorOpciones = validarOpcionesEntrega(
    datos.franjaReparto,
    datos.siFaltaProducto,
    datos.fechaEntrega,
  );
  if (errorOpciones) return { error: errorOpciones };
  const modo: ModoEntrega =
    datos.modoEntrega === "programado" ? "programado" : "antes_posible";
  const combos = await combosActivos();
  const lineas = armarLineasPedido(datos.lineas, combos);
  const contacto: ContactoPedido = {
    nombre: datos.contacto.nombre.trim(),
    email: datos.contacto.email.trim().toLowerCase(),
    telefono: datos.contacto.telefono.trim(),
    direccion: datos.contacto.direccion.trim(),
    horarios: textoEntrega(modo, datos.fechaEntrega, datos.franjaReparto),
  };
  const error = validarContacto(contacto);
  if (error) return { error };
  const pedidos = await leerArchivo();
  const { siguienteNumeroWeb, registrarTicketDesdePedido } = await import(
    "@/lib/cuentas"
  );
  const numeroTicket = await siguienteNumeroWeb();
  const pedido: Pedido = {
    id: randomUUID(),
    numeroTicket,
    creadoEn: new Date().toISOString(),
    estado: "sin_atender",
    canal: "web",
    clienteRegistrado: datos.clienteRegistrado,
    usuarioId: datos.usuarioId,
    contacto,
    franjaReparto: datos.franjaReparto,
    siFaltaProducto: datos.siFaltaProducto,
    modoEntrega: modo,
    fechaEntrega: datos.fechaEntrega,
    lineas: lineas.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      nombre: l.nombre,
      precio: l.precio,
      precioLista: l.precioLista,
      tipoPromo: l.tipoPromo,
      cantidad: l.cantidad,
    })),
    total: totalCarrito(lineas, combos),
  };
  pedidos.push(pedido);
  await escribirArchivo(pedidos);
  if (datos.clienteRegistrado) {
    await registrarTicketDesdePedido({
      email: contacto.email,
      pedidoId: pedido.id,
      numero: numeroTicket,
      total: pedido.total,
      fecha: pedido.creadoEn,
    });
  }
  return { pedido };
}

export async function listarPedidosDeCliente(filtro: {
  usuarioId?: string;
  email?: string;
}) {
  const pedidos = await listarPedidos();
  const email = filtro.email ? normalizarEmailLogin(filtro.email) : "";
  return pedidos.filter((p) => {
    if (filtro.usuarioId && p.usuarioId === filtro.usuarioId) return true;
    if (email && normalizarEmailLogin(p.contacto.email) === email) return true;
    return false;
  });
}

export async function cambiarEstadoPedido(id: string, estado: EstadoPedido) {
  const pedidos = await leerArchivo();
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) return { error: "No encontramos ese pedido." as const };
  pedido.estado = estado;
  await escribirArchivo(pedidos);
  return { pedido };
}
