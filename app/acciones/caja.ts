"use server";

import { revalidatePath } from "next/cache";
import {
  anularVentaCaja,
  devolverVentaCaja,
  guardarStockProducto,
  registrarVentaCaja,
} from "@/lib/caja";
import { agregarTicket, asegurarClienteCredito, leerCuentas } from "@/lib/cuentas";
import { precioConDescuentoCliente, precioLista } from "@/lib/precios";
import { leerAjustes } from "@/lib/ajustes";
import { leerProductos } from "@/lib/productos";
import { leerMediosPago } from "@/lib/medios-pago";
import { costoEnvio } from "@/lib/envio";
import { formatoPesos } from "@/lib/format";
import { ID_LINEA_ENVIO } from "@/lib/carrito";
import { marcarPedidoEnviando } from "@/lib/pedidos";
import { registrarRetiro } from "@/lib/retiros-caja";
import { puedeCobrar } from "@/lib/roles";
import { getSesion } from "@/lib/sesion";
import { nombreVisible } from "@/lib/venta-texto";
import { descuentoFicha, listarUsuarios, normalizarEmail } from "@/lib/usuarios";

export type EstadoCaja = {
  error?: string;
  ok?: string;
  ventaId?: string;
  numero?: number;
} | null;

function revalidar() {
  revalidatePath("/caja");
  revalidatePath("/catalogo");
  revalidatePath("/admin/cuentas");
  revalidatePath("/admin/pedidos");
  revalidatePath("/");
}

async function cerrarPedidoWeb(form: FormData) {
  const id = String(form.get("pedidoWebId") ?? "").trim();
  if (!id) return "";
  const resultado = await marcarPedidoEnviando(id);
  if ("error" in resultado) return ` ${resultado.error}`;
  return " El pedido web quedó en enviando y se da por entregado a los 30 minutos.";
}

async function exigirCaja() {
  const sesion = await getSesion();
  return sesion && puedeCobrar(sesion.rol) ? sesion : null;
}

async function empleadoDeTurno(form: FormData) {
  const id = String(form.get("empleadoId") ?? "").trim();
  if (!id) return { error: "Confirmá qué empleado está usando la caja." as const };
  const usuarios = await listarUsuarios();
  const elegido = usuarios.find((u) => u.id === id && (u.rol === "caja" || u.rol === "admin"));
  if (!elegido) return { error: "Ese empleado no puede usar la caja." as const };
  return {
    empleado: nombreVisible({ nombre: elegido.nombre, apellido: elegido.perfil?.apellido }),
    empleadoEmail: elegido.email,
  };
}

async function descuentoDeEmail(email: string) {
  const limpio = email.trim();
  if (!limpio.includes("@")) return 0;
  const usuarios = await listarUsuarios();
  const usuario = usuarios.find((u) => normalizarEmail(u.email) === normalizarEmail(limpio));
  return descuentoFicha(usuario?.perfil?.descuento) ?? 0;
}

function precioCargado(valor: unknown) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

async function lineasCobradas(form: FormData) {
  let crudo: { productoId?: string; cantidad?: number; precio?: number }[] = [];
  try {
    crudo = JSON.parse(String(form.get("lineas") ?? "[]"));
  } catch {
    return { error: "La venta no se pudo leer." as const };
  }
  if (!Array.isArray(crudo) || crudo.length === 0) {
    return { error: "Agregá productos antes de cobrar." as const };
  }
  const [ajustes, productos, descuento] = await Promise.all([
    leerAjustes(),
    leerProductos(),
    descuentoDeEmail(String(form.get("email") ?? "")),
  ]);
  const lineas = crudo
    .filter((l) => String(l.productoId ?? "") !== ID_LINEA_ENVIO)
    .map((l) => {
      const producto = productos.find((p) => p.id === l.productoId);
      const lista = producto ? precioLista(producto, ajustes) : 0;
      return {
        productoId: String(l.productoId ?? ""),
        cantidad: Number(l.cantidad) || 0,
        precio: precioCargado(l.precio) ?? precioConDescuentoCliente(lista, descuento),
      };
    });
  const envioCrudo = crudo.find((l) => String(l.productoId ?? "") === ID_LINEA_ENVIO);
  if (envioCrudo) {
    const subtotal = lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0);
    lineas.push({
      productoId: ID_LINEA_ENVIO,
      cantidad: 1,
      precio: precioCargado(envioCrudo.precio) ?? costoEnvio(subtotal, ajustes.envio),
    });
  }
  return { lineas, descuento };
}

export async function cobrarVenta(form: FormData): Promise<EstadoCaja> {
  const sesion = await exigirCaja();
  if (!sesion) return { error: "Solo caja o administración pueden cobrar." };
  const turno = await empleadoDeTurno(form);
  if ("error" in turno) return { error: turno.error };
  const armado = await lineasCobradas(form);
  if ("error" in armado) return { error: armado.error };
  const { lineas } = armado;
  const pedido = String(form.get("formaPago") ?? "").trim();
  const total = lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0);
  let formaPago = pedido;
  if (pedido === "mixto") {
    const efectivo = Math.round(Number(String(form.get("efectivoMixto") ?? "").replace(/\D/g, ""))) || 0;
    const transferencia = Math.round(Number(String(form.get("transferenciaMixto") ?? "").replace(/\D/g, ""))) || 0;
    if (efectivo < 1 || transferencia < 1) {
      return { error: "En el pago mixto cargá efectivo y transferencia." };
    }
    if (efectivo + transferencia !== total) {
      return { error: "Efectivo más transferencia tiene que dar el total de la venta." };
    }
    formaPago = `Efectivo ${formatoPesos(efectivo)} + Transferencia ${formatoPesos(transferencia)}`;
  } else {
    const medios = await leerMediosPago();
    const medio = medios.find(
      (m) => m.id === pedido || m.nombre.toLowerCase() === pedido.toLowerCase(),
    );
    if (!medio) return { error: "Esa forma de pago no está cargada en mantenimiento." };
    formaPago = medio.nombre;
  }
  const resultado = await registrarVentaCaja({
    empleado: turno.empleado,
    empleadoEmail: turno.empleadoEmail,
    cliente: String(form.get("cliente") ?? "Cliente genérico"),
    clienteId: String(form.get("clienteId") ?? ""),
    formaPago,
    lineas,
  });
  if ("error" in resultado) return { error: resultado.error };
  const avisoWeb = await cerrarPedidoWeb(form);
  revalidar();
  return {
    ok: `Factura ${resultado.venta.numero} lista. Total $${resultado.venta.total.toLocaleString("es-AR")}.${avisoWeb}`,
    ventaId: resultado.venta.id,
    numero: resultado.venta.numero,
  };
}

export async function generarDeudaVenta(form: FormData): Promise<EstadoCaja> {
  const sesion = await exigirCaja();
  if (!sesion) return { error: "Solo caja o administración pueden cobrar." };
  const email = String(form.get("email") ?? "").trim();
  const nombre = String(form.get("cliente") ?? "").trim();
  if (!email.includes("@")) {
    return { error: "Elegí un cliente cargado para dejar la venta en deuda." };
  }
  const turno = await empleadoDeTurno(form);
  if ("error" in turno) return { error: turno.error };
  const armado = await lineasCobradas(form);
  if ("error" in armado) return { error: armado.error };
  const { lineas } = armado;
  const resultado = await registrarVentaCaja({
    empleado: turno.empleado,
    empleadoEmail: turno.empleadoEmail,
    cliente: nombre || email,
    clienteId: String(form.get("clienteId") ?? ""),
    formaPago: "deuda",
    lineas,
  });
  if ("error" in resultado) return { error: resultado.error };

  const cuentas = await leerCuentas();
  const emailNorm = normalizarEmail(email);
  const telefono = String(form.get("telefono") ?? "");
  const tel = telefono.replace(/\D/g, "");
  let fiado = cuentas.clientes.find((c) => normalizarEmail(c.email) === emailNorm);
  if (!fiado && tel.length >= 8) {
    const porTel = cuentas.clientes.filter((c) => c.telefono.replace(/\D/g, "") === tel);
    if (porTel.length === 1) fiado = porTel[0];
  }
  if (!fiado) {
    const creado = await asegurarClienteCredito({
      email,
      nombre: nombre || email,
      telefono,
      limiteAlmacen: cuentas.ajustes.limiteAlmacenDefault,
      limiteEfectivo: cuentas.ajustes.limiteEfectivoDefault,
      credito: true,
    });
    fiado = creado.cliente;
  }
  if (!fiado) {
    await anularVentaCaja(resultado.venta.id);
    return { error: "No se pudo abrir la cuenta del cliente." };
  }
  const ticket = await agregarTicket({
    clienteId: fiado.id,
    numero: String(resultado.venta.numero),
    descripcion: `Factura ${resultado.venta.numero} en caja`,
    tipo: "almacen",
    medioPago: "cuenta",
    total: resultado.venta.total,
    debe: resultado.venta.total,
    lineas: resultado.venta.lineas.map((l) => ({
      nombre: l.nombre,
      codigo: l.codigo,
      monto: l.precio * l.cantidad,
    })),
  });
  if ("error" in ticket) {
    await anularVentaCaja(resultado.venta.id);
    return { error: ticket.error };
  }
  const avisoWeb = await cerrarPedidoWeb(form);
  revalidar();
  return {
    ok: `Factura ${resultado.venta.numero} quedó como deuda de ${nombre || email}.${avisoWeb}`,
    ventaId: resultado.venta.id,
    numero: resultado.venta.numero,
  };
}

export async function anularVenta(form: FormData): Promise<EstadoCaja> {
  const sesion = await exigirCaja();
  if (!sesion) return { error: "No tenés permiso." };
  const resultado = await anularVentaCaja(String(form.get("id") ?? ""));
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Anulamos la venta ${resultado.numero} y devolvimos el stock.` };
}

export async function devolverVenta(form: FormData): Promise<EstadoCaja> {
  const sesion = await exigirCaja();
  if (!sesion) return { error: "No tenés permiso." };
  let items: { productoId: string; cantidad: number }[] = [];
  try {
    items = JSON.parse(String(form.get("items") ?? "[]")) as {
      productoId: string;
      cantidad: number;
    }[];
  } catch {
    return { error: "No se pudieron leer los productos a devolver." };
  }
  const resultado = await devolverVentaCaja({
    ventaId: String(form.get("ventaId") ?? ""),
    empleado: sesion.nombre,
    reponerStock: String(form.get("reponerStock") ?? "") === "1",
    items,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  const stockTxt = resultado.reponerStock
    ? "y se repuso el stock"
    : "sin modificar el stock";
  return {
    ok: resultado.completa
      ? `Devolución total de la factura ${resultado.numero} ${stockTxt}.`
      : `Devolución parcial de la factura ${resultado.numero} por ${formatoPesos(resultado.total)} ${stockTxt}.`,
    numero: resultado.numero,
  };
}

export async function actualizarStockCaja(form: FormData): Promise<EstadoCaja> {
  const sesion = await exigirCaja();
  if (!sesion) return { error: "No tenés permiso." };
  const stock = Number(String(form.get("stock") ?? "").replace(/[^\d]/g, ""));
  const resultado = await guardarStockProducto(
    String(form.get("productoId") ?? ""),
    stock,
    String(form.get("mostrarEnCaja") ?? "") === "1",
  );
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `${resultado.nombre}: stock ${resultado.stock}.` };
}

export async function registrarRetiroCaja(form: FormData): Promise<EstadoCaja> {
  const sesion = await exigirCaja();
  if (!sesion) return { error: "Solo caja o administración pueden registrar un retiro." };
  const turno = await empleadoDeTurno(form);
  if ("error" in turno) return { error: turno.error };
  const resultado = await registrarRetiro({
    empleado: turno.empleado,
    empleadoEmail: turno.empleadoEmail,
    concepto: String(form.get("concepto") ?? ""),
    monto: Number(String(form.get("monto") ?? "").replace(/\D/g, "")),
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Retiro de ${formatoPesos(resultado.retiro.monto)} · ${resultado.retiro.concepto}.` };
}
