import { randomUUID } from "crypto";
import { descontarStock } from "@/lib/caja";
import { armarLineasPedido, lineasProducto, totalCarrito, type LineaCarrito } from "@/lib/carrito";
import { leerProductos } from "@/lib/productos";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { leerAjustes } from "@/lib/ajustes";
import { combosActivos } from "@/lib/promos";
import type {
  ContactoPedido,
  EstadoPedido,
  FranjaReparto,
  ModoEntrega,
  PagoPedido,
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

const MINUTOS_PARA_CERRAR_ENVIO = 30;

export async function listarPedidos() {
  const pedidos = await leerArchivo();
  const ahora = Date.now();
  let cambio = false;
  for (const pedido of pedidos) {
    if (pedido.estado !== "enviando" || !pedido.enviadoEn) continue;
    const salio = new Date(pedido.enviadoEn).getTime();
    if (Number.isFinite(salio) && ahora - salio >= MINUTOS_PARA_CERRAR_ENVIO * 60 * 1000) {
      pedido.estado = "terminado";
      cambio = true;
    }
  }
  if (cambio) await escribirArchivo(pedidos);
  return pedidos.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export function resolverPagoPedido(datos: {
  forma: string;
  montoCuenta: number;
  total: number;
  habilitada: boolean;
  disponible: number;
  saldo?: number;
}): { pago: PagoPedido } | { error: string } {
  const total = Math.max(0, Math.round(datos.total) || 0);
  const disponible = Math.max(0, Math.round(datos.disponible) || 0);
  const saldo = Math.max(0, Math.round(datos.saldo ?? 0));
  if (datos.forma === "saldo") {
    if (saldo < total) return { error: "El saldo no alcanza para este pedido." };
    return { pago: { forma: "saldo", cuentaCorriente: 0, transferencia: 0, saldo: total } };
  }
  if (datos.forma === "saldo_transferencia") {
    if (saldo < 1 || saldo >= total) {
      return { error: "El saldo tiene que cubrir una parte. El resto se transfiere." };
    }
    return {
      pago: { forma: "saldo_transferencia", cuentaCorriente: 0, transferencia: total - saldo, saldo },
    };
  }
  if (datos.forma === "cuenta_corriente") {
    if (!datos.habilitada || disponible < total) {
      return { error: "La cuenta corriente no alcanza para este pedido." };
    }
    return {
      pago: { forma: "cuenta_corriente", cuentaCorriente: total, transferencia: 0 },
    };
  }
  if (datos.forma === "mixto") {
    const cc = Math.round(datos.montoCuenta) || 0;
    if (!datos.habilitada || disponible < 1) {
      return { error: "No tenés disponible en cuenta corriente para un pago mixto." };
    }
    if (cc < 1 || cc > disponible || cc >= total) {
      return {
        error:
          "En un pago mixto, la cuenta corriente cubre una parte y la transferencia el resto.",
      };
    }
    return { pago: { forma: "mixto", cuentaCorriente: cc, transferencia: total - cc } };
  }
  return { pago: { forma: "transferencia", cuentaCorriente: 0, transferencia: total } };
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
  if (siFalta && siFalta !== "reemplazo_misma_marca" && siFalta !== "omitir") {
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
  siFaltaProducto?: SiFaltaProducto;
  modoEntrega: ModoEntrega;
  fechaEntrega: string;
  pago?: { forma: string; cuentaCorriente: number };
  cuenta?: { habilitada: boolean; disponible: number; saldo?: number };
  clienteRegistrado: boolean;
  usuarioId?: string;
}) {
  if (lineasProducto(datos.lineas).length === 0) {
    return { error: "El pedido está vacío." as const };
  }
  const errorOpciones = validarOpcionesEntrega(
    datos.franjaReparto,
    datos.siFaltaProducto ?? "",
    datos.fechaEntrega,
  );
  if (errorOpciones) return { error: errorOpciones };
  const modo: ModoEntrega =
    datos.modoEntrega === "programado" ? "programado" : "antes_posible";
  const [combos, ajustes] = await Promise.all([combosActivos(), leerAjustes()]);
  const lineas = armarLineasPedido(datos.lineas, combos, ajustes.envio);
  const total = totalCarrito(lineas, combos);
  const pagoResuelto = resolverPagoPedido({
    forma: datos.pago?.forma ?? "transferencia",
    montoCuenta: datos.pago?.cuentaCorriente ?? 0,
    total,
    habilitada: datos.cuenta?.habilitada ?? false,
    disponible: datos.cuenta?.disponible ?? 0,
    saldo: datos.cuenta?.saldo ?? 0,
  });
  if ("error" in pagoResuelto) return { error: pagoResuelto.error as string };
  const contacto: ContactoPedido = {
    nombre: datos.contacto.nombre.trim(),
    email: datos.contacto.email.trim().toLowerCase(),
    telefono: datos.contacto.telefono.trim(),
    direccion: datos.contacto.direccion.trim(),
    horarios: textoEntrega(modo, datos.fechaEntrega, datos.franjaReparto),
  };
  const error = validarContacto(contacto);
  if (error) return { error };
  const productos = await leerProductos();
  for (const linea of lineasProducto(datos.lineas)) {
    const producto = productos.find((p) => p.id === linea.id);
    if (!producto) return { error: `${linea.nombre} ya no está en el catálogo.` as const };
    if (typeof producto.stock === "number" && producto.stock < linea.cantidad) {
      return {
        error:
          producto.stock <= 0
            ? `No hay stock de ${producto.nombre}.` as const
            : `De ${producto.nombre} quedan ${producto.stock}.` as const,
      };
    }
  }
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
    pago: pagoResuelto.pago,
    lineas: lineas.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      nombre: l.nombre,
      precio: l.precio,
      precioLista: l.precioLista,
      tipoPromo: l.tipoPromo,
      cantidad: l.cantidad,
    })),
    total,
  };
  if (datos.clienteRegistrado && (pagoResuelto.pago.saldo ?? 0) > 0) {
    const { descontarSaldoCliente } = await import("@/lib/cuentas");
    const debitado = await descontarSaldoCliente(contacto.email, pagoResuelto.pago.saldo ?? 0);
    if ("error" in debitado) return { error: debitado.error };
  }
  pedidos.push(pedido);
  await escribirArchivo(pedidos);
  await descontarStock(
    lineas
      .filter((l) => l.codigo !== "ENVIO")
      .map((l) => ({ productoId: l.id, cantidad: l.cantidad })),
  ).catch((error) => {
    console.error("[pedido] stock", error);
  });
  if (datos.clienteRegistrado) {
    const aCuenta = pagoResuelto.pago.cuentaCorriente;
    if (aCuenta > 0) {
      await registrarTicketDesdePedido({
        email: contacto.email,
        pedidoId: pedido.id,
        numero: numeroTicket,
        total: aCuenta,
        fecha: pedido.creadoEn,
      });
    }
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

export async function crearRecargaCuenta(datos: {
  usuarioId: string;
  email: string;
  nombre: string;
  telefono: string;
  monto: number;
}) {
  const monto = Math.round(datos.monto);
  if (!Number.isFinite(monto) || monto < 1) return { error: "Ingresá un monto para cargar." as const };
  if (monto > 2_000_000) return { error: "El máximo para cargar es $ 2.000.000." as const };
  const pedidos = await leerArchivo();
  const { siguienteNumeroWeb } = await import("@/lib/cuentas");
  const numeroTicket = await siguienteNumeroWeb();
  const pedido: Pedido = {
    id: randomUUID(),
    numeroTicket,
    creadoEn: new Date().toISOString(),
    estado: "sin_atender",
    canal: "web",
    clienteRegistrado: true,
    usuarioId: datos.usuarioId,
    contacto: {
      nombre: datos.nombre.trim() || "Cliente",
      email: datos.email.trim().toLowerCase(),
      telefono: datos.telefono.trim() || "000",
      direccion: "Saldo a cuenta",
      horarios: "Recarga de cuenta",
    },
    pago: { forma: "transferencia", cuentaCorriente: 0, transferencia: monto, saldo: 0 },
    esRecarga: true,
    lineas: [
      {
        id: "recarga",
        codigo: "RECARGA",
        nombre: "Recarga de cuenta",
        precio: monto,
        cantidad: 1,
      },
    ],
    total: monto,
  };
  pedidos.push(pedido);
  await escribirArchivo(pedidos);
  return { ok: true as const, pedido };
}

export async function resolverRecarga(id: string, acreditar: boolean) {
  const pedidos = await leerArchivo();
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido || !pedido.esRecarga) return { error: "No encontramos esa recarga." as const };
  if (pedido.recargaAcreditada) return { error: "Esa recarga ya fue acreditada." as const };
  if (pedido.recargaRechazada) return { error: "Esa recarga ya fue rechazada." as const };
  if (acreditar) {
    const { sumarSaldoCliente } = await import("@/lib/cuentas");
    const suma = await sumarSaldoCliente(pedido.contacto.email, pedido.total);
    if ("error" in suma) return { error: suma.error };
    pedido.recargaAcreditada = true;
  } else {
    pedido.recargaRechazada = true;
  }
  pedido.estado = "terminado";
  await escribirArchivo(pedidos);
  return { ok: true as const, pedido };
}

export async function cambiarEstadoPedido(id: string, estado: EstadoPedido) {
  const pedidos = await leerArchivo();
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) return { error: "No encontramos ese pedido." as const };
  pedido.estado = estado;
  if (estado === "enviando") pedido.enviadoEn = new Date().toISOString();
  await escribirArchivo(pedidos);
  return { pedido };
}

export async function marcarPedidoEnviando(id: string) {
  const pedidos = await leerArchivo();
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido || pedido.esRecarga) return { error: "No encontramos ese pedido de mercadería." as const };
  if (pedido.estado === "terminado") return { error: "Ese pedido ya está finalizado." as const };
  pedido.estado = "enviando";
  pedido.enviadoEn = new Date().toISOString();
  await escribirArchivo(pedidos);
  return { ok: true as const, numero: pedido.numeroTicket || String(pedido.id) };
}

export async function ajustarMontoRecarga(id: string, monto: number) {
  const cantidad = Math.round(monto);
  if (!Number.isFinite(cantidad) || cantidad < 1) {
    return { error: "El importe tiene que ser mayor a 0." as const };
  }
  const pedidos = await leerArchivo();
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido || !pedido.esRecarga) return { error: "No encontramos esa recarga." as const };
  if (pedido.recargaAcreditada || pedido.recargaRechazada) {
    return { error: "Esa recarga ya fue resuelta." as const };
  }
  pedido.total = cantidad;
  pedido.pago = {
    forma: "transferencia",
    cuentaCorriente: 0,
    transferencia: cantidad,
    saldo: 0,
  };
  pedido.lineas = pedido.lineas.map((linea) => ({ ...linea, precio: cantidad }));
  await escribirArchivo(pedidos);
  return { ok: true as const };
}
