import { randomUUID } from "crypto";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { leerAjustes } from "@/lib/ajustes";
import { plazoCuentaDias } from "@/lib/plazo-cuenta";
import {
  asegurarUsuariosFiado,
  listarUsuarios,
  normalizarEmail,
} from "@/lib/usuarios";
import type {
  AjustesCuenta,
  BaseCuentas,
  ClienteFiado,
  LineaTicket,
  NovedadAdmin,
  PagoCuenta,
  ResumenCliente,
  SolicitudCuenta,
  TicketDeuda,
  TipoNovedad,
  TipoTicket,
  MedioPagoTicket,
} from "@/types/cuenta";

const ARCHIVO = "cuentas.json";

const AJUSTES_VACIOS: AjustesCuenta = {
  alias: "",
  cbu: "",
  titular: "La Triple L",
  banco: "",
  limiteAlmacenDefault: 50000,
  limiteEfectivoDefault: 0,
  plazoEfectivoHoras: 48,
  importadoEn: "",
  archivoOrigen: "",
  ultimoTicketWeb: 0,
  ultimoTicketTienda: 0,
};

function baseVacia(): BaseCuentas {
  return {
    ajustes: { ...AJUSTES_VACIOS },
    clientes: [],
    tickets: [],
    pagos: [],
    solicitudes: [],
    novedades: [],
  };
}

function hoyFecha() {
  return new Date().toISOString().slice(0, 10);
}

function ahoraIso() {
  return new Date().toISOString();
}

export function soloDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

export function telefonoClave(valor: string) {
  let d = soloDigitos(valor);
  if (d.startsWith("54") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  return d;
}

export function telefonosCoinciden(a: string, b: string) {
  const x = telefonoClave(a);
  const y = telefonoClave(b);
  if (!x || !y || /^0+$/.test(x) || /^0+$/.test(y)) return false;
  if (x === y) return true;
  const min = Math.min(x.length, y.length);
  if (min < 8) return false;
  return x.slice(-min) === y.slice(-min);
}

function masDias(fecha: string, dias: number) {
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function siguienteNumero(data: BaseCuentas, prefijo: "WEB" | "T") {
  if (prefijo === "WEB") {
    const n = (data.ajustes.ultimoTicketWeb ?? 0) + 1;
    data.ajustes.ultimoTicketWeb = n;
    return `WEB-${String(n).padStart(5, "0")}`;
  }
  const n = (data.ajustes.ultimoTicketTienda ?? 0) + 1;
  data.ajustes.ultimoTicketTienda = n;
  return `T-${String(n).padStart(5, "0")}`;
}

function normalizarTicket(ticket: TicketDeuda): TicketDeuda {
  return {
    ...ticket,
    numero: ticket.numero?.trim() || ticket.id,
    vencimiento: ticket.vencimiento || masDias(ticket.fecha, 7),
    adjunto: ticket.adjunto || "",
    lineas: Array.isArray(ticket.lineas) ? ticket.lineas : [],
  };
}

function normalizarBase(raw: Partial<BaseCuentas> | null): BaseCuentas {
  const vacia = baseVacia();
  if (!raw || typeof raw !== "object") return vacia;
  return {
    ajustes: { ...AJUSTES_VACIOS, ...(raw.ajustes ?? {}) },
    clientes: Array.isArray(raw.clientes) ? raw.clientes : [],
    tickets: Array.isArray(raw.tickets)
      ? raw.tickets.map((t) => normalizarTicket(t))
      : [],
    pagos: Array.isArray(raw.pagos) ? raw.pagos : [],
    solicitudes: Array.isArray(raw.solicitudes) ? raw.solicitudes : [],
    novedades: Array.isArray(raw.novedades) ? raw.novedades : [],
  };
}

async function leerBase(): Promise<BaseCuentas> {
  const parsed = await leerJsonData<Partial<BaseCuentas> | null>(ARCHIVO, null);
  return normalizarBase(parsed);
}

async function guardarBase(data: BaseCuentas) {
  await escribirJsonData(ARCHIVO, data);
}

export async function sincronizarUsuariosCuenta() {
  const data = await leerBase();
  await asegurarUsuariosFiado(
    data.clientes
      .filter((c) => c.activo)
      .map((c) => ({
        email: c.email,
        nombre: c.nombre,
        telefono: c.telefono,
        pin: c.pinInicial || "1234",
      })),
  );
  return data;
}

export async function leerCuentas() {
  return sincronizarUsuariosCuenta();
}

export async function leerAjustesCuenta() {
  const data = await leerBase();
  return data.ajustes;
}

export async function cantidadCuentasPorTelefono(login: string) {
  const data = await leerBase();
  const enFiado = data.clientes.filter((c) =>
    telefonosCoinciden(c.telefono, login),
  ).length;
  const usuarios = await listarUsuarios();
  const enUsuarios = usuarios.filter((u) =>
    telefonosCoinciden(u.perfil?.telefono ?? "", login),
  ).length;
  return Math.max(enFiado, enUsuarios);
}

export async function resolverLogin(login: string) {
  const clave = login.trim();
  if (!clave) return null;
  if (clave.includes("@")) return normalizarEmail(clave);

  const data = await leerBase();
  const clientes = data.clientes.filter((c) =>
    telefonosCoinciden(c.telefono, clave),
  );
  if (clientes.length === 1) return normalizarEmail(clientes[0].email);

  const usuarios = await listarUsuarios();
  const porTel = usuarios.filter((u) =>
    telefonosCoinciden(u.perfil?.telefono ?? "", clave),
  );
  if (porTel.length === 1) return porTel[0].email;
  return null;
}

export function saldoTickets(tickets: TicketDeuda[], tipo?: TipoTicket) {
  return tickets
    .filter((t) => t.estado === "vigente" && (tipo ? t.tipo === tipo : true))
    .reduce((acc, t) => acc + Math.max(0, t.debe), 0);
}

export function resumenDe(
  cliente: ClienteFiado,
  data: BaseCuentas,
): ResumenCliente {
  const propios = data.tickets.filter((t) => t.clienteId === cliente.id);
  const vigentes = propios
    .filter((t) => t.estado === "vigente" && t.debe > 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  const pagados = propios
    .filter((t) => t.estado === "pagada" || t.debe <= 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const saldoAlmacen = saldoTickets(propios, "almacen");
  const saldoEfectivo = saldoTickets(propios, "efectivo");
  const saldoTotal = saldoAlmacen + saldoEfectivo;
  return {
    cliente,
    saldoTotal,
    saldoAlmacen,
    saldoEfectivo,
    disponibleAlmacen: Math.max(0, cliente.limiteAlmacen - saldoAlmacen),
    disponibleEfectivo: Math.max(0, cliente.limiteEfectivo - saldoEfectivo),
    ticketsVigentes: vigentes,
    ticketsPagados: pagados,
    pagos: data.pagos
      .filter((p) => p.clienteId === cliente.id)
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)),
    solicitudesPendientes: data.solicitudes.filter(
      (s) => s.clienteId === cliente.id && s.estado === "pendiente",
    ),
  };
}

export async function resumenPorEmail(email: string) {
  const data = await leerCuentas();
  const cliente = data.clientes.find(
    (c) => normalizarEmail(c.email) === normalizarEmail(email),
  );
  if (!cliente) return null;
  return { data, resumen: resumenDe(cliente, data) };
}

export async function resumenPorId(id: string) {
  const data = await leerCuentas();
  const cliente = data.clientes.find((c) => c.id === id && c.activo);
  if (!cliente) return null;
  return { data, resumen: resumenDe(cliente, data) };
}

export async function asegurarFichaCliente(datos: {
  email: string;
  nombre: string;
  telefono: string;
}) {
  const email = normalizarEmail(datos.email);
  const data = await leerBase();
  let cliente = data.clientes.find((c) => normalizarEmail(c.email) === email);
  if (cliente) {
    let cambio = false;
    if (datos.nombre.trim() && cliente.nombre !== datos.nombre.trim()) {
      cliente.nombre = datos.nombre.trim();
      cambio = true;
    }
    if (datos.telefono.trim() && cliente.telefono !== datos.telefono.trim()) {
      cliente.telefono = datos.telefono.trim();
      cambio = true;
    }
    if (!cliente.activo) {
      cliente.activo = true;
      cambio = true;
    }
    if (cambio) await guardarBase(data);
    return { ok: true as const, cliente };
  }
  cliente = {
    id: `cli-${randomUUID().slice(0, 8)}`,
    nombre: datos.nombre.trim() || email,
    telefono: datos.telefono.trim() || "000",
    email,
    pinInicial: "1234",
    limiteAlmacen: 0,
    limiteEfectivo: 0,
    aliasCbu: "",
    activo: true,
  };
  data.clientes.push(cliente);
  await guardarBase(data);
  return { ok: true as const, cliente };
}

export async function listarResumenes() {
  const data = await leerCuentas();
  const resumenes = data.clientes
    .filter((c) => c.activo)
    .map((c) => resumenDe(c, data))
    .sort(
      (a, b) =>
        b.saldoTotal - a.saldoTotal ||
        a.cliente.nombre.localeCompare(b.cliente.nombre),
    );
  return { data, resumenes };
}

export async function listarFichasAdmin() {
  const usuarios = await listarUsuarios();
  for (const u of usuarios) {
    if (u.rol !== "cliente" || u.estado !== "activa") continue;
    await asegurarFichaCliente({
      email: u.email,
      nombre: u.nombre,
      telefono: u.perfil?.telefono ?? "",
    });
  }
  return listarResumenes();
}

export async function contarNovedadesPendientes() {
  const data = await leerBase();
  return data.novedades.filter((n) => !n.leida).length;
}

export async function siguienteNumeroWeb() {
  const data = await leerBase();
  const numero = siguienteNumero(data, "WEB");
  await guardarBase(data);
  return numero;
}

export async function registrarTicketDesdePedido(datos: {
  email: string;
  pedidoId: string;
  numero: string;
  total: number;
  fecha?: string;
}) {
  const data = await leerBase();
  const cliente = data.clientes.find(
    (c) =>
      c.activo && normalizarEmail(c.email) === normalizarEmail(datos.email),
  );
  if (!cliente) return { ok: false as const };
  if (data.tickets.some((t) => t.pedidoId === datos.pedidoId)) {
    return { ok: true as const };
  }
  const fecha = datos.fecha?.slice(0, 10) || hoyFecha();
  const ajustes = await leerAjustes();
  const ticket: TicketDeuda = {
    id: `t-${randomUUID().slice(0, 8)}`,
    numero: datos.numero,
    clienteId: cliente.id,
    fecha,
    vencimiento: masDias(fecha, plazoCuentaDias(cliente.plazoCuenta, ajustes.plazoCuenta)),
    descripcion: `Pedido web ${datos.numero}`,
    tipo: "almacen",
    total: Math.max(0, Math.round(datos.total) || 0),
    debe: Math.max(0, Math.round(datos.total) || 0),
    ultimoPago: null,
    estado: "vigente",
    origen: "web",
    medioPago: "web",
    pedidoId: datos.pedidoId,
    adjunto: "",
    lineas: [],
  };
  if (ticket.total <= 0) return { ok: true as const };
  data.tickets.unshift(ticket);
  await guardarBase(data);
  return { ok: true as const, ticket };
}

export async function actualizarEmailClienteFiado(
  emailAnterior: string,
  emailNuevo: string,
) {
  const data = await leerBase();
  const anterior = normalizarEmail(emailAnterior);
  const nuevo = normalizarEmail(emailNuevo);
  let cambio = false;
  for (const cliente of data.clientes) {
    if (normalizarEmail(cliente.email) === anterior) {
      cliente.email = nuevo;
      cambio = true;
    }
  }
  if (cambio) await guardarBase(data);
  return { ok: true as const };
}

export async function actualizarContactoFiado(
  email: string,
  datos: { telefono?: string; nombre?: string },
) {
  const data = await leerBase();
  const cliente = data.clientes.find(
    (c) => normalizarEmail(c.email) === normalizarEmail(email),
  );
  if (!cliente) return { ok: false as const };
  if (datos.telefono) cliente.telefono = datos.telefono.trim();
  if (datos.nombre) cliente.nombre = datos.nombre.trim();
  await guardarBase(data);
  return { ok: true as const };
}

export async function registrarNovedad(datos: {
  tipo: TipoNovedad;
  titulo: string;
  detalle: string;
  clienteId?: string;
  solicitudId?: string;
}) {
  const data = await leerBase();
  const novedad: NovedadAdmin = {
    id: randomUUID(),
    tipo: datos.tipo,
    titulo: datos.titulo,
    detalle: datos.detalle,
    clienteId: datos.clienteId,
    solicitudId: datos.solicitudId,
    leida: false,
    creadoEn: ahoraIso(),
  };
  data.novedades.unshift(novedad);
  await guardarBase(data);
  return novedad;
}

function aplicarATicket(ticket: TicketDeuda, monto: number) {
  const aplicado = Math.min(ticket.debe, Math.max(0, monto));
  ticket.debe = Math.round((ticket.debe - aplicado) * 100) / 100;
  if (ticket.debe <= 0) {
    ticket.debe = 0;
    ticket.estado = "pagada";
  }
  ticket.ultimoPago = hoyFecha();
  return aplicado;
}

function ticketsFifo(data: BaseCuentas, clienteId: string) {
  return data.tickets
    .filter((t) => t.clienteId === clienteId && t.estado === "vigente" && t.debe > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
}

function registrarPago(
  data: BaseCuentas,
  datos: Omit<PagoCuenta, "id" | "creadoEn" | "estado"> & { estado?: PagoCuenta["estado"] },
) {
  const pago: PagoCuenta = {
    id: randomUUID(),
    creadoEn: ahoraIso(),
    estado: datos.estado ?? "confirmado",
    clienteId: datos.clienteId,
    ticketId: datos.ticketId,
    monto: datos.monto,
    tipo: datos.tipo,
    medio: datos.medio,
    nota: datos.nota,
    comprobante: datos.comprobante,
  };
  data.pagos.unshift(pago);
  return pago;
}

export async function marcarTicketPagado(ticketId: string, nota = "") {
  const data = await leerBase();
  const ticket = data.tickets.find((t) => t.id === ticketId);
  if (!ticket) return { error: "No encontramos ese ticket." as const };
  if (ticket.debe <= 0) return { error: "Ese ticket ya está pagado." as const };
  const monto = ticket.debe;
  aplicarATicket(ticket, monto);
  registrarPago(data, {
    clienteId: ticket.clienteId,
    ticketId: ticket.id,
    monto,
    tipo: "total",
    medio: "admin",
    nota: nota || "Marcado como pagado",
    comprobante: "",
  });
  await guardarBase(data);
  return { ok: true as const, ticket };
}

export async function marcarDeudaTotalPagada(clienteId: string, nota = "") {
  const data = await leerBase();
  const vigentes = ticketsFifo(data, clienteId);
  if (vigentes.length === 0) {
    return { error: "Este cliente no tiene deuda vigente." as const };
  }
  let total = 0;
  for (const ticket of vigentes) {
    total += aplicarATicket(ticket, ticket.debe);
  }
  registrarPago(data, {
    clienteId,
    ticketId: null,
    monto: total,
    tipo: "total",
    medio: "admin",
    nota: nota || "Deuda total marcada como pagada",
    comprobante: "",
  });
  await guardarBase(data);
  return { ok: true as const, monto: total };
}

export async function registrarPagoParcial(datos: {
  clienteId: string;
  ticketId?: string;
  monto: number;
  nota?: string;
  medio?: string;
}) {
  const monto = Math.round(Number(datos.monto) || 0);
  if (monto <= 0) return { error: "Ingresá un monto mayor a 0." as const };
  const data = await leerBase();
  const cliente = data.clientes.find((c) => c.id === datos.clienteId);
  if (!cliente) return { error: "No encontramos ese cliente." as const };

  let restante = monto;
  if (datos.ticketId) {
    const ticket = data.tickets.find(
      (t) => t.id === datos.ticketId && t.clienteId === datos.clienteId,
    );
    if (!ticket) return { error: "No encontramos ese ticket." as const };
    restante -= aplicarATicket(ticket, restante);
  } else {
    for (const ticket of ticketsFifo(data, datos.clienteId)) {
      if (restante <= 0) break;
      restante -= aplicarATicket(ticket, restante);
    }
  }
  const aplicado = monto - Math.max(0, restante);
  if (aplicado <= 0) {
    return { error: "No había deuda vigente para imputar ese pago." as const };
  }
  registrarPago(data, {
    clienteId: datos.clienteId,
    ticketId: datos.ticketId ?? null,
    monto: aplicado,
    tipo: aplicado < monto || ticketsFifo(data, datos.clienteId).length > 0 ? "parcial" : "total",
    medio: datos.medio || "admin",
    nota: datos.nota?.trim() || "Pago parcial",
    comprobante: "",
  });
  await guardarBase(data);
  return { ok: true as const, aplicado };
}

export async function actualizarLimites(datos: {
  clienteId: string;
  limiteAlmacen: number;
  limiteEfectivo: number;
}) {
  const data = await leerBase();
  const cliente = data.clientes.find((c) => c.id === datos.clienteId);
  if (!cliente) return { error: "No encontramos ese cliente." as const };
  cliente.limiteAlmacen = Math.max(0, Math.round(datos.limiteAlmacen) || 0);
  cliente.limiteEfectivo = Math.max(0, Math.round(datos.limiteEfectivo) || 0);
  await guardarBase(data);
  return { ok: true as const, cliente };
}

export async function guardarPoliticaMora(datos: {
  email: string;
  nombre: string;
  telefono: string;
  moraModo?: "escala" | "fijo" | "sin";
  moraPorcentaje?: number;
  moraCreditoModo?: "escala" | "fijo" | "sin";
  moraCreditoPorcentaje?: number;
  moraCuentaModo?: "escala" | "fijo" | "sin";
  moraCuentaPorcentaje?: number;
  plazoCuenta?: number | null;
}) {
  const email = normalizarEmail(datos.email);
  const data = await leerBase();
  let cliente = data.clientes.find((c) => normalizarEmail(c.email) === email);
  if (!cliente) {
    const sinCambios =
      (datos.moraCreditoModo ?? datos.moraModo ?? "escala") === "escala" &&
      (datos.moraCuentaModo ?? "escala") === "escala" &&
      datos.plazoCuenta == null;
    if (sinCambios) return { ok: true as const };
    const tel = soloDigitos(datos.telefono);
    cliente = {
      id: `cli-${randomUUID().slice(0, 8)}`,
      nombre: datos.nombre.trim() || email,
      telefono: datos.telefono.trim() || "000",
      email,
      pinInicial: tel.length >= 8 && !/^0+$/.test(tel) ? tel.slice(-4) : "1234",
      limiteAlmacen: 0,
      limiteEfectivo: 0,
      aliasCbu: "",
      activo: true,
    };
    data.clientes.push(cliente);
  }
  const porcentaje = (modo: "escala" | "fijo" | "sin" | undefined, valor?: number) =>
    modo === "fijo" ? Math.min(100, Math.max(0, Math.round(valor || 0))) : 0;
  if (datos.moraCreditoModo) {
    cliente.moraCreditoModo = datos.moraCreditoModo;
    cliente.moraCreditoPorcentaje = porcentaje(datos.moraCreditoModo, datos.moraCreditoPorcentaje);
  }
  if (datos.moraCuentaModo) {
    cliente.moraCuentaModo = datos.moraCuentaModo;
    cliente.moraCuentaPorcentaje = porcentaje(datos.moraCuentaModo, datos.moraCuentaPorcentaje);
    cliente.moraModo = datos.moraCuentaModo;
    cliente.moraPorcentaje = cliente.moraCuentaPorcentaje;
  } else if (datos.moraModo) {
    cliente.moraModo = datos.moraModo;
    cliente.moraPorcentaje = porcentaje(datos.moraModo, datos.moraPorcentaje);
  }
  if (typeof datos.plazoCuenta === "number" && datos.plazoCuenta >= 1 && datos.plazoCuenta <= 365) {
    cliente.plazoCuenta = Math.round(datos.plazoCuenta);
  } else if (datos.plazoCuenta === null) delete cliente.plazoCuenta;
  await guardarBase(data);
  return { ok: true as const, cliente };
}

export async function actualizarTicket(datos: {
  ticketId: string;
  numero?: string;
  descripcion?: string;
  tipo?: TipoTicket;
  medioPago?: MedioPagoTicket;
  total?: number;
  debe?: number;
  vencimiento?: string;
  adjunto?: string;
  interesDesactivado?: boolean;
  interesManual?: number | null;
  lineas?: LineaTicket[];
}) {
  const data = await leerBase();
  const ticket = data.tickets.find((t) => t.id === datos.ticketId);
  if (!ticket) return { error: "No encontramos ese ticket." as const };
  if (datos.descripcion !== undefined) {
    ticket.descripcion = datos.descripcion.trim() || ticket.descripcion;
  }
  if (datos.tipo) ticket.tipo = datos.tipo === "efectivo" ? "efectivo" : "almacen";
  if (datos.medioPago) ticket.medioPago = datos.medioPago;
  if (datos.total !== undefined) ticket.total = Math.max(0, Math.round(datos.total) || 0);
  if (datos.debe !== undefined) {
    ticket.debe = Math.max(0, Math.round(datos.debe) || 0);
    if (ticket.debe > ticket.total) ticket.total = ticket.debe;
  }
  ticket.debe = Math.min(ticket.debe, ticket.total || ticket.debe);
  ticket.estado = ticket.debe > 0 ? "vigente" : "pagada";
  if (datos.vencimiento) ticket.vencimiento = datos.vencimiento.slice(0, 10);
  if (datos.adjunto !== undefined) ticket.adjunto = datos.adjunto;
  if (datos.interesDesactivado !== undefined) {
    ticket.interesDesactivado = datos.interesDesactivado;
  }
  if (datos.interesManual !== undefined) {
    ticket.interesManual = datos.interesManual;
  }
  if (datos.lineas) {
    ticket.lineas = datos.lineas
      .map((l) => ({
        nombre: l.nombre.trim(),
        codigo: l.codigo.trim(),
        ...(typeof l.monto === "number" ? { monto: l.monto } : {}),
      }))
      .filter((l) => l.nombre);
  }
  await guardarBase(data);
  return { ok: true as const, ticket };
}

export async function borrarTicketDeuda(ticketId: string) {
  const data = await leerBase();
  const ticket = data.tickets.find((t) => t.id === ticketId);
  if (!ticket) return { error: "No encontramos esa deuda." as const };
  data.tickets = data.tickets.filter((t) => t.id !== ticketId);
  await guardarBase(data);
  return { ok: true as const, numero: ticket.numero || ticket.id };
}

export async function ticketParaFactura(ticketId: string) {
  const data = await leerBase();
  const ticket = data.tickets.find((t) => t.id === ticketId);
  if (!ticket) return null;
  const cliente = data.clientes.find((c) => c.id === ticket.clienteId);
  return { ticket, cliente: cliente?.nombre || "Cliente" };
}

export async function agregarTicket(datos: {
  clienteId: string;
  numero?: string;
  fecha?: string;
  vencimiento?: string;
  descripcion?: string;
  tipo?: TipoTicket;
  medioPago?: MedioPagoTicket;
  total: number;
  debe?: number;
  adjunto?: string;
  lineas?: LineaTicket[];
}) {
  const total = Math.max(0, Math.round(datos.total) || 0);
  if (total <= 0) return { error: "Ingresá el importe del ticket." as const };
  const data = await leerBase();
  const cliente = data.clientes.find((c) => c.id === datos.clienteId);
  if (!cliente) return { error: "No encontramos ese cliente." as const };
  const debe = Math.max(0, Math.min(total, Math.round(datos.debe ?? total) || 0));
  const fecha = datos.fecha || hoyFecha();
  const ajustes = await leerAjustes();
  const dias =
    datos.tipo === "efectivo" ? 7 : plazoCuentaDias(cliente.plazoCuenta, ajustes.plazoCuenta);
  const numero = datos.numero?.trim() || siguienteNumero(data, "T");
  const medio =
    datos.medioPago === "local" ||
    datos.medioPago === "transferencia" ||
    datos.medioPago === "cuenta"
      ? datos.medioPago
      : "cuenta";
  const ticket: TicketDeuda = {
    id: `t-${randomUUID().slice(0, 8)}`,
    numero,
    clienteId: datos.clienteId,
    fecha,
    vencimiento: datos.vencimiento || masDias(fecha, dias),
    descripcion: datos.descripcion?.trim() || `Ticket ${numero}`,
    tipo: datos.tipo === "efectivo" ? "efectivo" : "almacen",
    total,
    debe,
    ultimoPago: debe < total ? hoyFecha() : null,
    estado: debe > 0 ? "vigente" : "pagada",
    origen: "tienda",
    medioPago: medio,
    adjunto: datos.adjunto || "",
    lineas: (datos.lineas ?? []).filter((l) => l.nombre.trim()),
  };
  data.tickets.unshift(ticket);
  const cobrado = total - debe;
  if (cobrado > 0) {
    registrarPago(data, {
      clienteId: datos.clienteId,
      ticketId: ticket.id,
      monto: cobrado,
      tipo: debe > 0 ? "parcial" : "total",
      medio: medio === "transferencia" ? "transferencia" : "local",
      nota: ticket.descripcion,
      comprobante: "",
    });
  }
  await guardarBase(data);
  return { ok: true as const, ticket };
}

export async function guardarAjustesCuenta(patch: Partial<AjustesCuenta>) {
  const data = await leerBase();
  data.ajustes = { ...data.ajustes, ...patch };
  await guardarBase(data);
  return data.ajustes;
}

export async function guardarAliasCliente(clienteId: string, aliasCbu: string) {
  const data = await leerBase();
  const cliente = data.clientes.find((c) => c.id === clienteId);
  if (!cliente) return { error: "No encontramos ese cliente." as const };
  cliente.aliasCbu = aliasCbu.trim();
  await guardarBase(data);
  return { ok: true as const, cliente };
}

export async function actualizarPinInicial(clienteId: string, pin: string) {
  const data = await leerBase();
  const cliente = data.clientes.find((c) => c.id === clienteId);
  if (!cliente) return { error: "No encontramos ese cliente." as const };
  cliente.pinInicial = pin;
  await guardarBase(data);
  return { ok: true as const };
}

export async function agregarClienteFiado(datos: {
  nombre: string;
  telefono: string;
  limiteAlmacen?: number;
  limiteEfectivo?: number;
  pin?: string;
}) {
  const nombre = datos.nombre.trim();
  if (nombre.length < 2) return { error: "Ingresá el nombre del cliente." as const };
  const data = await leerBase();
  const slug = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "") || "cliente";
  let email = `${slug}@cuenta.latriplel.com`;
  let n = 2;
  while (data.clientes.some((c) => c.email === email)) {
    email = `${slug}${n}@cuenta.latriplel.com`;
    n += 1;
  }
  const tel = soloDigitos(datos.telefono);
  const pin =
    datos.pin ||
    (tel.length >= 8 && !/^0+$/.test(tel) ? tel.slice(-4) : "1234");
  const cliente: ClienteFiado = {
    id: `cli-${randomUUID().slice(0, 8)}`,
    nombre,
    telefono: datos.telefono.trim() || "000",
    email,
    pinInicial: pin,
    limiteAlmacen:
      datos.limiteAlmacen ?? data.ajustes.limiteAlmacenDefault,
    limiteEfectivo:
      datos.limiteEfectivo ?? data.ajustes.limiteEfectivoDefault,
    aliasCbu: "",
    activo: true,
  };
  data.clientes.push(cliente);
  await guardarBase(data);
  await asegurarUsuariosFiado([
    {
      email: cliente.email,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      pin: cliente.pinInicial,
    },
  ]);
  return { ok: true as const, cliente };
}

export async function guardarLimitesCliente(datos: {
  email: string;
  nombre: string;
  telefono: string;
  limiteAlmacen: number;
  limiteEfectivo: number;
}) {
  const email = normalizarEmail(datos.email);
  const data = await leerBase();
  let cliente = data.clientes.find((c) => normalizarEmail(c.email) === email);
  const limiteAlmacen = Math.max(0, Math.round(datos.limiteAlmacen) || 0);
  const limiteEfectivo = Math.max(0, Math.round(datos.limiteEfectivo) || 0);
  if (!cliente) {
    if (limiteAlmacen < 1 && limiteEfectivo < 1) return { ok: true as const };
    const tel = soloDigitos(datos.telefono);
    cliente = {
      id: `cli-${randomUUID().slice(0, 8)}`,
      nombre: datos.nombre.trim() || email,
      telefono: datos.telefono.trim() || "000",
      email,
      pinInicial: tel.length >= 8 && !/^0+$/.test(tel) ? tel.slice(-4) : "1234",
      limiteAlmacen,
      limiteEfectivo,
      aliasCbu: "",
      activo: true,
    };
    data.clientes.push(cliente);
  } else {
    cliente.nombre = datos.nombre.trim() || cliente.nombre;
    if (datos.telefono.trim()) cliente.telefono = datos.telefono.trim();
    cliente.limiteAlmacen = limiteAlmacen;
    cliente.limiteEfectivo = limiteEfectivo;
    cliente.activo = true;
  }
  await guardarBase(data);
  return { ok: true as const, cliente };
}

function clientePorEmail(data: BaseCuentas, email: string) {
  const mail = normalizarEmail(email);
  return data.clientes.find((c) => normalizarEmail(c.email) === mail) ?? null;
}

export async function guardarCondicionesCredito(datos: {
  email: string;
  cuotasMaximas: 1 | 2 | 3 | 6;
  cuotasHabilitadas?: (1 | 2 | 3 | 6)[];
  interesModo?: "general" | "propio";
  interes1?: number;
  interes2?: number;
  interes3?: number;
  interes6?: number;
}) {
  const data = await leerBase();
  const cliente = clientePorEmail(data, datos.email);
  if (!cliente) return { ok: true as const };
  cliente.cuotasMaximas = datos.cuotasMaximas;
  cliente.cuotasHabilitadas = datos.cuotasHabilitadas?.length ? datos.cuotasHabilitadas : [datos.cuotasMaximas];
  cliente.interesModo = datos.interesModo === "propio" ? "propio" : "general";
  const aplicar = (clave: "interes1" | "interes2" | "interes3" | "interes6", valor?: number) => {
    if (cliente.interesModo === "propio" && typeof valor === "number" && Number.isFinite(valor)) cliente[clave] = valor;
    else delete cliente[clave];
  };
  aplicar("interes1", datos.interes1);
  aplicar("interes2", datos.interes2);
  aplicar("interes3", datos.interes3);
  aplicar("interes6", datos.interes6);
  await guardarBase(data);
  return { ok: true as const };
}

export async function descontarSaldoCliente(email: string, monto: number) {
  const cantidad = Math.round(monto);
  if (!Number.isFinite(cantidad) || cantidad < 1) {
    return { error: "El saldo a usar no es válido." as const };
  }
  const data = await leerBase();
  const cliente = clientePorEmail(data, email);
  const saldo = Math.max(0, Math.round(cliente?.saldo ?? 0));
  if (!cliente || saldo < cantidad) {
    return { error: "No alcanza el saldo de la cuenta." as const };
  }
  cliente.saldo = saldo - cantidad;
  await guardarBase(data);
  return { ok: true as const, saldo: cliente.saldo };
}

export async function sumarSaldoCliente(email: string, monto: number) {
  const cantidad = Math.round(monto);
  if (!Number.isFinite(cantidad) || cantidad < 1) {
    return { error: "El monto a acreditar no es válido." as const };
  }
  const data = await leerBase();
  const cliente = clientePorEmail(data, email);
  if (!cliente) return { error: "Esa cuenta no tiene ficha de cliente." as const };
  cliente.saldo = Math.max(0, Math.round(cliente.saldo ?? 0)) + cantidad;
  await guardarBase(data);
  return { ok: true as const, saldo: cliente.saldo };
}

export async function quitarFiadoPorEmail(email: string) {
  const mail = normalizarEmail(email);
  if (!mail.includes("@")) return { ok: true as const };
  const data = await leerBase();
  const cliente = data.clientes.find((c) => normalizarEmail(c.email) === mail);
  if (!cliente) return { ok: true as const };
  const conDeuda = data.tickets.some(
    (t) => t.clienteId === cliente.id && t.estado === "vigente" && t.debe > 0,
  );
  if (conDeuda) return { ok: true as const, conservado: true as const };
  data.clientes = data.clientes.filter((c) => c.id !== cliente.id);
  await guardarBase(data);
  return { ok: true as const };
}

export async function reasignarEmailFiado(anterior: string, nuevo: string) {
  const desde = normalizarEmail(anterior);
  const hacia = normalizarEmail(nuevo);
  if (!desde.includes("@") || !hacia.includes("@") || desde === hacia) return;
  const data = await leerBase();
  const cliente = data.clientes.find((c) => normalizarEmail(c.email) === desde);
  if (!cliente) return;
  cliente.email = hacia;
  await guardarBase(data);
}

export async function asegurarClienteCredito(datos: {
  email: string;
  nombre: string;
  telefono: string;
  limiteAlmacen: number;
  limiteEfectivo: number;
  credito: boolean;
}) {
  const email = normalizarEmail(datos.email);
  const data = await leerBase();
  let cliente = data.clientes.find((c) => normalizarEmail(c.email) === email);
  const limiteAlmacen = Math.max(0, Math.round(datos.limiteAlmacen) || 0);
  const limiteEfectivo = Math.max(0, Math.round(datos.limiteEfectivo) || 0);
  if (!cliente) {
    if (!datos.credito) return { ok: true as const };
    const tel = soloDigitos(datos.telefono);
    cliente = {
      id: `cli-${randomUUID().slice(0, 8)}`,
      nombre: datos.nombre.trim() || email,
      telefono: datos.telefono.trim() || "000",
      email,
      pinInicial: tel.length >= 8 && !/^0+$/.test(tel) ? tel.slice(-4) : "1234",
      limiteAlmacen,
      limiteEfectivo,
      aliasCbu: "",
      activo: true,
    };
    data.clientes.push(cliente);
  } else {
    cliente.nombre = datos.nombre.trim() || cliente.nombre;
    if (datos.telefono.trim()) cliente.telefono = datos.telefono.trim();
    cliente.limiteAlmacen = datos.credito ? limiteAlmacen : 0;
    cliente.limiteEfectivo = datos.credito ? limiteEfectivo : 0;
    cliente.activo = true;
  }
  await guardarBase(data);
  return { ok: true as const, cliente };
}

export async function solicitarEfectivo(datos: {
  email: string;
  monto: number;
  aliasCbu: string;
  nota?: string;
}) {
  const monto = Math.round(Number(datos.monto) || 0);
  if (monto <= 0) return { error: "Ingresá el monto que necesitás." as const };
  if (datos.aliasCbu.trim().length < 6) {
    return { error: "Cargá tu alias o CBU para acreditar el efectivo." as const };
  }
  const encontrado = await resumenPorEmail(datos.email);
  if (!encontrado) {
    return { error: "Tu perfil de cuenta corriente todavía no está creado." as const };
  }
  const { data, resumen } = encontrado;
  resumen.cliente.aliasCbu = datos.aliasCbu.trim();
  const solicitud: SolicitudCuenta = {
    id: randomUUID(),
    clienteId: resumen.cliente.id,
    tipo: "efectivo",
    monto,
    aliasCbu: datos.aliasCbu.trim(),
    nota: datos.nota?.trim() || "",
    comprobante: "",
    creadoEn: ahoraIso(),
    estado: "pendiente",
  };
  data.solicitudes.unshift(solicitud);
  data.novedades.unshift({
    id: randomUUID(),
    tipo: "efectivo",
    titulo: `Pedido de efectivo · ${resumen.cliente.nombre}`,
    detalle: `${resumen.cliente.nombre} pide ${monto} en efectivo. Acreditar en ${datos.aliasCbu.trim()} (plazo ${data.ajustes.plazoEfectivoHoras} h).`,
    clienteId: resumen.cliente.id,
    solicitudId: solicitud.id,
    leida: false,
    creadoEn: ahoraIso(),
  });
  await guardarBase(data);
  return {
    ok: true as const,
    solicitud,
    plazoHoras: data.ajustes.plazoEfectivoHoras,
    cliente: resumen.cliente,
  };
}

export async function informarPagoCliente(datos: {
  email: string;
  monto: number;
  medio: string;
  nota?: string;
  comprobante?: string;
}) {
  const monto = Math.round(Number(datos.monto) || 0);
  if (monto <= 0) return { error: "Ingresá el monto que pagaste." as const };
  const encontrado = await resumenPorEmail(datos.email);
  if (!encontrado) {
    return { error: "Tu perfil de cuenta corriente todavía no está creado." as const };
  }
  const { data, resumen } = encontrado;
  const solicitud: SolicitudCuenta = {
    id: randomUUID(),
    clienteId: resumen.cliente.id,
    tipo: "pago",
    monto,
    aliasCbu: "",
    nota: datos.nota?.trim() || "",
    comprobante: datos.comprobante?.trim() || "",
    creadoEn: ahoraIso(),
    estado: "pendiente",
  };
  data.solicitudes.unshift(solicitud);
  registrarPago(data, {
    clienteId: resumen.cliente.id,
    ticketId: null,
    monto,
    tipo: "parcial",
    medio: datos.medio || "aviso",
    nota: datos.nota?.trim() || "El cliente informó un pago",
    comprobante: datos.comprobante?.trim() || "",
    estado: "pendiente",
  });
  data.novedades.unshift({
    id: randomUUID(),
    tipo: "pago",
    titulo: `Aviso de pago · ${resumen.cliente.nombre}`,
    detalle: `${resumen.cliente.nombre} informa un pago de ${monto} (${datos.medio || "aviso"}). Confirmalo y descontalo de la deuda.`,
    clienteId: resumen.cliente.id,
    solicitudId: solicitud.id,
    leida: false,
    creadoEn: ahoraIso(),
  });
  await guardarBase(data);
  return { ok: true as const, solicitud, cliente: resumen.cliente };
}

export async function atenderSolicitud(
  solicitudId: string,
  estado: SolicitudCuenta["estado"],
) {
  const data = await leerBase();
  const solicitud = data.solicitudes.find((s) => s.id === solicitudId);
  if (!solicitud) return { error: "No encontramos esa solicitud." as const };
  solicitud.estado = estado;
  await guardarBase(data);
  return { ok: true as const, solicitud };
}

export type CreditoPendiente = {
  id: string;
  clienteId: string;
  nombre: string;
  monto: number;
  aliasCbu: string;
  nota: string;
};

export async function listarCreditosPendientes(): Promise<CreditoPendiente[]> {
  const data = await leerBase();
  return data.solicitudes
    .filter((s) => s.tipo === "efectivo" && s.estado === "pendiente")
    .map((s) => {
      const cliente = data.clientes.find((c) => c.id === s.clienteId);
      return {
        id: s.id,
        clienteId: s.clienteId,
        nombre: cliente?.nombre || "Cliente",
        monto: s.monto,
        aliasCbu: s.aliasCbu,
        nota: s.nota,
      };
    });
}

export async function resolverCreditoSolicitado(datos: {
  solicitudId: string;
  monto: number;
  aceptar: boolean;
}) {
  const monto = Math.round(Number(datos.monto) || 0);
  if (datos.aceptar && monto < 1) return { error: "El importe tiene que ser mayor a 0." as const };
  const data = await leerBase();
  const solicitud = data.solicitudes.find((s) => s.id === datos.solicitudId && s.tipo === "efectivo");
  if (!solicitud || solicitud.estado !== "pendiente") {
    return { error: "Esa solicitud de crédito ya no está pendiente." as const };
  }
  solicitud.estado = datos.aceptar ? "atendida" : "rechazada";
  if (datos.aceptar) solicitud.monto = monto;
  for (const novedad of data.novedades) {
    if (novedad.solicitudId === solicitud.id) novedad.leida = true;
  }
  await guardarBase(data);
  if (!datos.aceptar) return { ok: true as const, nombre: "" };
  const ticket = await agregarTicket({
    clienteId: solicitud.clienteId,
    tipo: "efectivo",
    total: monto,
    descripcion: "Crédito en efectivo",
    medioPago: "transferencia",
  });
  if ("error" in ticket) return { error: ticket.error };
  const cliente = (await leerBase()).clientes.find((c) => c.id === solicitud.clienteId);
  return { ok: true as const, nombre: cliente?.nombre || "el cliente" };
}

export async function marcarNovedadesLeidas(ids?: string[]) {
  const data = await leerBase();
  for (const novedad of data.novedades) {
    if (!ids || ids.includes(novedad.id)) novedad.leida = true;
  }
  await guardarBase(data);
  return { ok: true as const };
}

export function parsearLineas(texto: string): LineaTicket[] {
  return texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const m = linea.match(/^(\d+)\s+[-–|]\s+(.+)$/);
      if (m) return { codigo: m[1], nombre: m[2].trim() };
      const m2 = linea.match(/^(.+?)\s+[-–|]\s+(\d+)$/);
      if (m2) return { codigo: m2[2], nombre: m2[1].trim() };
      return { codigo: "", nombre: linea };
    });
}

export function lineasATexto(lineas: LineaTicket[]) {
  return lineas
    .map((l) => (l.codigo ? `${l.codigo} - ${l.nombre}` : l.nombre))
    .join("\n");
}
