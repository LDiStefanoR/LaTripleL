"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import {
  actualizarInventario,
  actualizarPedidoProveedor,
  crearPedidoProveedor,
  entrarStock,
  guardarProveedor,
  quitarPedidoProveedor,
  quitarProveedor,
  recibirPedidoProveedor,
  registrarComprobanteDirecto,
  registrarRecepcionPedido,
  regularizarStock,
} from "@/lib/deposito";
import { guardarMedioPago, quitarMedioPago } from "@/lib/medios-pago";
import { exigirPermisoCaja } from "@/lib/exigir-permiso";
import { PLAZOS_CREDITO, type PlazoCredito } from "@/lib/credito-cuotas";
import { diasPlazoValido } from "@/lib/plazo-cuenta";
import { leerPermisosForm } from "@/lib/permisos-caja";
import { puedeCobrar } from "@/lib/roles";
import { getSesion } from "@/lib/sesion";
import {
  asegurarClienteCredito,
  guardarCondicionesCredito,
  guardarLimitesCliente,
  guardarPoliticaMora,
  reasignarEmailFiado,
} from "@/lib/cuentas";
import {
  actualizarPerfilUsuario,
  actualizarTipoCuenta,
  buscarUsuarioPorId,
  cambiarEmailUsuario,
  cambiarPasswordUsuario,
  crearUsuarioAdmin,
  descuentoFicha,
  guardarPermisosCaja,
  listarUsuarios,
  pinOPasswordValido,
} from "@/lib/usuarios";
import type { PerfilCliente, TipoCuentaCliente } from "@/types/auth";

export type EstadoDeposito = {
  error?: string;
  ok?: string;
  cliente?: {
    id: string;
    nombre: string;
    apellido: string;
    codigo: string;
    email: string;
    rol: string;
    telefono: string;
    direccion: string;
    cumpleanos: string;
    documento: string;
    nota: string;
    descuento: number;
    cuentaWeb: boolean;
    limiteAlmacen: number;
    limiteEfectivo: number;
    moraModo?: "escala" | "fijo" | "sin";
    moraPorcentaje?: number;
    moraCreditoModo?: "escala" | "fijo" | "sin";
    moraCreditoPorcentaje?: number;
    moraCuentaModo?: "escala" | "fijo" | "sin";
    moraCuentaPorcentaje?: number;
    cuotasHabilitadas?: PlazoCredito[];
    interesModo?: "general" | "propio";
    interes1?: number;
    interes2?: number;
    interes3?: number;
    interes6?: number;
    cuotasMaximas?: 1 | 2 | 3 | 6;
    plazoCuenta?: number;
  };
} | null;

function revalidar() {
  revalidatePath("/caja");
  revalidatePath("/cuenta");
  revalidatePath("/catalogo");
  revalidatePath("/promos");
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath("/");
}

async function sesionCaja(permiso?: Parameters<typeof exigirPermisoCaja>[0]) {
  if (permiso) return exigirPermisoCaja(permiso);
  const sesion = await getSesion();
  return sesion && puedeCobrar(sesion.rol) ? sesion : null;
}

function texto(form: FormData, clave: string) {
  return String(form.get(clave) ?? "").trim();
}

function tasaCampo(form: FormData, clave: string) {
  const raw = texto(form, clave);
  if (!raw) return undefined;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 500) return undefined;
  return Math.round(n * 10) / 10;
}

function modoMora(form: FormData, clave: string) {
  const valor = texto(form, clave);
  return valor === "fijo" || valor === "sin" ? valor : "escala";
}

function condicionesCredito(form: FormData): { error: string } | {
  cuotasMaximas: 1 | 2 | 3 | 6;
  cuotasHabilitadas: PlazoCredito[];
  interesModo: "general" | "propio";
  interes1?: number;
  interes2?: number;
  interes3?: number;
  interes6?: number;
} {
  const cuotas = PLAZOS_CREDITO.filter((plazo) => form.get(`cuota${plazo}`) === "1");
  if (cuotas.length === 0) return { error: "Elegí al menos una cuota: 1, 2, 3 o 6." };
  const interesModo = texto(form, "interesModo") === "propio" ? "propio" : "general";
  const tasas = {
    interes1: tasaCampo(form, "interes1"),
    interes2: tasaCampo(form, "interes2"),
    interes3: tasaCampo(form, "interes3"),
    interes6: tasaCampo(form, "interes6"),
  };
  if (interesModo === "propio") {
    for (const plazo of cuotas) {
      const valor = tasas[`interes${plazo}` as keyof typeof tasas];
      if (valor === undefined) return { error: `Ingresá el interés de ${plazo} ${plazo === 1 ? "cuota" : "cuotas"}.` };
    }
  }
  return {
    cuotasMaximas: cuotas[cuotas.length - 1],
    cuotasHabilitadas: cuotas,
    interesModo,
    ...tasas,
  };
}

function politicaForm(form: FormData, credito: boolean, corriente: boolean): { error: string } | {
  moraCreditoModo?: "escala" | "fijo" | "sin";
  moraCreditoPorcentaje?: number;
  moraCuentaModo?: "escala" | "fijo" | "sin";
  moraCuentaPorcentaje?: number;
  plazoCuenta?: number | null;
} {
  const salida: {
    moraCreditoModo?: "escala" | "fijo" | "sin";
    moraCreditoPorcentaje?: number;
    moraCuentaModo?: "escala" | "fijo" | "sin";
    moraCuentaPorcentaje?: number;
    plazoCuenta?: number | null;
  } = {};
  if (credito) {
    const modo = modoMora(form, "moraCreditoModo");
    const porcentaje = monto(form, "moraCreditoPorcentaje");
    if (modo === "fijo" && (porcentaje < 1 || porcentaje > 100)) {
      return { error: "El interés semanal del crédito tiene que estar entre 1 y 100." };
    }
    salida.moraCreditoModo = modo;
    salida.moraCreditoPorcentaje = porcentaje;
  }
  if (corriente) {
    const modo = modoMora(form, "moraCuentaModo");
    const porcentaje = monto(form, "moraCuentaPorcentaje");
    if (modo === "fijo" && (porcentaje < 1 || porcentaje > 100)) {
      return { error: "El interés semanal de la cuenta corriente tiene que estar entre 1 y 100." };
    }
    salida.moraCuentaModo = modo;
    salida.moraCuentaPorcentaje = porcentaje;
    if (texto(form, "plazoOrigen") === "propio") {
      const dias = diasPlazoValido(texto(form, "plazoCuenta"));
      if (!dias) return { error: "Ingresá los días para pagar la mercadería, entre 1 y 365." };
      salida.plazoCuenta = dias;
    } else salida.plazoCuenta = null;
  }
  return salida;
}

export async function guardarProveedorCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("mantenimiento"))) return { error: "No tenés permiso." };
  const resultado = await guardarProveedor({
    nombre: texto(form, "nombre"),
    telefono: texto(form, "telefono"),
    nota: texto(form, "nota"),
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Guardamos el proveedor ${resultado.proveedor.nombre}.` };
}

export async function quitarProveedorCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("mantenimiento"))) return { error: "No tenés permiso." };
  const resultado = await quitarProveedor(texto(form, "id"));
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Eliminamos el proveedor ${resultado.nombre}.` };
}

export async function generarPedidoProveedor(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("stock"))) return { error: "No tenés permiso." };
  let crudo: { productoId?: string; cantidad?: number }[] = [];
  try {
    crudo = JSON.parse(String(form.get("lineas") ?? "[]"));
  } catch {
    return { error: "El pedido no se pudo leer." };
  }
  if (!Array.isArray(crudo)) return { error: "El pedido no se pudo leer." };
  const resultado = await crearPedidoProveedor({
    proveedorId: texto(form, "proveedorId"),
    lineas: crudo.map((l) => ({
      productoId: String(l.productoId ?? ""),
      cantidad: Number(l.cantidad) || 0,
    })),
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok: `Pedido ${resultado.pedido.numero} a ${resultado.pedido.proveedorNombre}. El stock no cambia hasta que lo recepciones.`,
  };
}

export async function actualizarPedidoCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("stock"))) return { error: "No tenés permiso." };
  let crudo: { productoId?: string; cantidad?: number }[] = [];
  try {
    crudo = JSON.parse(String(form.get("lineas") ?? "[]"));
  } catch {
    return { error: "El pedido no se pudo leer." };
  }
  if (!Array.isArray(crudo)) return { error: "El pedido no se pudo leer." };
  const resultado = await actualizarPedidoProveedor({
    id: texto(form, "id"),
    proveedorId: texto(form, "proveedorId"),
    lineas: crudo.map((l) => ({
      productoId: String(l.productoId ?? ""),
      cantidad: Number(l.cantidad) || 0,
    })),
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Actualizamos el pedido ${resultado.numero}.` };
}

export async function recibirPedidoCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("stock"))) return { error: "No tenés permiso." };
  const resultado = await recibirPedidoProveedor(texto(form, "id"));
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Recibimos el pedido ${resultado.numero} y sumamos el stock.` };
}

export async function recepcionarPedidoCaja(form: FormData): Promise<EstadoDeposito> {
  const sesion = await sesionCaja("stock");
  if (!sesion) return { error: "No tenés permiso." };
  let crudo: { productoId?: string; cantidad?: number; recibido?: number; costo?: number; margen?: number; precio?: number }[] = [];
  try {
    crudo = JSON.parse(String(form.get("lineas") ?? "[]"));
  } catch {
    return { error: "La recepción no se pudo leer." };
  }
  if (!Array.isArray(crudo)) return { error: "La recepción no se pudo leer." };
  const resultado = await registrarRecepcionPedido({
    id: texto(form, "id"),
    empleado: sesion.nombre,
    comprobante: texto(form, "comprobante"),
    fechaComprobante: texto(form, "fecha"),
    lineas: crudo.map((l) => ({
      productoId: String(l.productoId ?? ""),
      cantidad: Number(l.cantidad) || 0,
      recibido: Number(l.recibido) || 0,
      costo: Number(l.costo),
      margen: Number(l.margen),
      precioVisible: Number(l.precio),
    })),
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  const detalle =
    resultado.estado === "recibido"
      ? "Quedó recibido completo."
      : resultado.estado === "parcial"
        ? "Quedó con recepción parcial."
        : "No marcaste unidades recibidas.";
  return { ok: `Actualizamos la recepción del pedido ${resultado.numero}. ${detalle}` };
}

export async function quitarPedidoCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("stock"))) return { error: "No tenés permiso." };
  const resultado = await quitarPedidoProveedor(texto(form, "id"));
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Borramos el pedido ${resultado.numero}.` };
}

export async function regularizarStockCaja(form: FormData): Promise<EstadoDeposito> {
  const sesion = await sesionCaja("stock");
  if (!sesion) return { error: "No tenés permiso." };
  const resultado = await regularizarStock({
    productoId: texto(form, "productoId"),
    contado: Number(String(form.get("contado") ?? "").replace(",", ".")),
    empleado: sesion.nombre,
  });
  if ("error" in resultado) return { error: resultado.error };
  const { movimiento } = resultado;
  const antes = movimiento.anterior == null ? "sin control" : String(movimiento.anterior);
  revalidar();
  return {
    ok: `${movimiento.codigo}: el stock pasó de ${antes} a ${movimiento.nuevo}.`,
  };
}

export async function entrarStockCaja(form: FormData): Promise<EstadoDeposito> {
  const sesion = await sesionCaja("stock");
  if (!sesion) return { error: "No tenés permiso." };
  const resultado = await entrarStock({
    productoId: texto(form, "productoId"),
    cantidad: Number(String(form.get("cantidad") ?? "").replace(",", ".")),
    costo: Number(String(form.get("costo") ?? "").replace(/[^\d]/g, "")),
    margen: Number(String(form.get("margen") ?? "").replace(",", ".")),
    precioVisible: Number(String(form.get("precio") ?? "").replace(/[^\d]/g, "")),
    empleado: sesion.nombre,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  const { entrada } = resultado;
  return {
    ok: `${entrada.codigo}: entraron ${entrada.cantidad}. Stock ${entrada.stockNuevo}. Precio de venta ${entrada.precio}.`,
  };
}

export async function entrarComprobanteCaja(form: FormData): Promise<EstadoDeposito> {
  const sesion = await sesionCaja("stock");
  if (!sesion) return { error: "No tenés permiso." };
  let crudo: { productoId?: string; cantidad?: number; costo?: number; margen?: number; precio?: number }[] = [];
  try {
    crudo = JSON.parse(String(form.get("lineas") ?? "[]"));
  } catch {
    return { error: "El comprobante no se pudo leer." };
  }
  if (!Array.isArray(crudo)) return { error: "El comprobante no se pudo leer." };
  const resultado = await registrarComprobanteDirecto({
    numero: texto(form, "comprobante"),
    fecha: texto(form, "fecha"),
    proveedorId: texto(form, "proveedorId"),
    empleado: sesion.nombre,
    lineas: crudo.map((l) => ({
      productoId: String(l.productoId ?? ""),
      cantidad: Number(l.cantidad) || 0,
      costo: Number(String(l.costo ?? "").replace(/[^\d]/g, "")),
      margen: Number(String(l.margen ?? "").replace(",", ".")),
      precioVisible: Number(String(l.precio ?? "").replace(/[^\d]/g, "")),
    })),
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok: `Factura ${resultado.numero}: entraron ${resultado.articulos} artículos por ${resultado.total}.`,
  };
}

export async function actualizarInventarioCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("stock"))) return { error: "No tenés permiso." };
  const resultado = await actualizarInventario({
    productoId: texto(form, "productoId"),
    stock: texto(form, "stock"),
    stockMinimo: texto(form, "stockMinimo"),
    costo: texto(form, "costo"),
    margen: texto(form, "margen"),
    precioVisible: texto(form, "precio"),
    proveedorId: texto(form, "proveedorId"),
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Actualizamos el inventario de ${resultado.codigo}.` };
}

function perfilMostrador(datos: {
  telefono: string;
  direccion: string;
  codigo: string;
  apellido: string;
  cumpleanos: string;
  documento: string;
  descuento?: number;
}): PerfilCliente {
  return {
    tipoPersona: "persona",
    tipoLocal: "Cliente de mostrador",
    productosInteres: "Compra en el local",
    direccion: datos.direccion.trim() || "Garay 1005",
    telefono: datos.telefono.trim(),
    horarioAtencion: "",
    deseaAsesor: false,
    codigo: datos.codigo,
    apellido: datos.apellido,
    cumpleanos: datos.cumpleanos,
    documento: datos.documento,
    descuento: datos.descuento,
  };
}

function monto(form: FormData, clave: string) {
  const n = Math.round(Number(String(form.get(clave) ?? "").replace(/[^\d]/g, "")) || 0);
  return Math.max(0, n);
}

export async function cargarClienteCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("clientes"))) return { error: "No tenés permiso." };
  const nombre = texto(form, "nombre");
  const apellido = texto(form, "apellidos");
  const codigo = texto(form, "codigo");
  const telefono = texto(form, "telefono");
  const direccion = texto(form, "direccion");
  const cumpleanos = texto(form, "cumpleanos");
  const documento = texto(form, "documento");
  const nota = texto(form, "nota");
  const descuento = descuentoFicha(texto(form, "descuento")) ?? 0;
  const cuentaWeb = String(form.get("cuentaWeb") ?? "") === "1";
  const mail = texto(form, "email");
  const passwordWeb = texto(form, "password");
  const darCredito = String(form.get("credito") ?? "") === "1";
  const cuentaCorriente = String(form.get("cuentaCorriente") ?? "") === "1";
  const limiteCredito = monto(form, "limiteCredito");
  const limiteMercaderia = monto(form, "limiteMercaderia");
  const digitos = telefono.replace(/\D/g, "");
  if (nombre.length < 2) return { error: "Ingresá el nombre." };
  if (digitos.length < 8) return { error: "Ingresá un teléfono válido." };
  if (cuentaWeb && !mail.includes("@")) return { error: "Para la cuenta web ingresá un mail." };
  if (cuentaWeb) {
    const errorClave = pinOPasswordValido(passwordWeb);
    if (errorClave) return { error: errorClave };
  }
  if (darCredito && limiteCredito < 1) return { error: "Ingresá el límite de crédito." };
  if (cuentaCorriente && limiteMercaderia < 1) {
    return { error: "Ingresá el límite de la cuenta corriente." };
  }
  const politicaAlta = politicaForm(form, darCredito, cuentaCorriente);
  if ("error" in politicaAlta) return politicaAlta;
  const condicionesAlta = darCredito ? condicionesCredito(form) : null;
  if (condicionesAlta && "error" in condicionesAlta) return condicionesAlta;
  const existentes = await listarUsuarios();
  if (
    codigo &&
    existentes.some((u) => (u.perfil?.codigo ?? "").toLowerCase() === codigo.toLowerCase())
  ) {
    return { error: "Ya hay un cliente con ese código." };
  }
  const doc = documento.replace(/\D/g, "");
  if (
    doc &&
    existentes.some((u) => (u.perfil?.documento ?? "").replace(/\D/g, "") === doc)
  ) {
    return { error: "Ya hay un cliente con ese CUIT o DNI." };
  }
  const email = cuentaWeb ? mail : `${digitos}@mostrador.latriplel`;
  const password = cuentaWeb ? passwordWeb : randomBytes(9).toString("base64url");
  const tipoCuenta =
    darCredito ? "linea_credito" : cuentaCorriente ? "credito_super" : descuento > 0 ? "descuentos" : "generico";
  const creado = await crearUsuarioAdmin({
    email,
    nombre,
    password,
    rol: "cliente",
    tipoCuenta,
  });
  if ("error" in creado) return { error: creado.error };
  const visible = [nombre, apellido].filter(Boolean).join(" ");
  const perfil = await actualizarPerfilUsuario(creado.usuario.id, {
    nombre,
    notaInterna: nota,
    perfil: perfilMostrador({
      telefono,
      direccion,
      codigo,
      apellido,
      cumpleanos,
      documento,
      descuento: descuento || undefined,
    }),
  });
  if ("error" in perfil && perfil.error) return { error: perfil.error };
  if (darCredito || cuentaCorriente) {
    await asegurarClienteCredito({
      email: creado.usuario.email,
      nombre: visible,
      telefono,
      limiteAlmacen: cuentaCorriente ? limiteMercaderia : 0,
      limiteEfectivo: darCredito ? limiteCredito : 0,
      credito: true,
    });
  }
  if (darCredito || cuentaCorriente) {
    await guardarPoliticaMora({
      email: creado.usuario.email,
      nombre: visible,
      telefono,
      ...politicaAlta,
    });
  }
  if (condicionesAlta) {
    await guardarCondicionesCredito({
      email: creado.usuario.email,
      ...condicionesAlta,
    });
  }
  revalidar();
  return {
    ok: cuentaWeb
      ? `Cargamos a ${visible}. Entra a la web con el mail y la contraseña.`
      : `Cargamos a ${visible}. Quedó en la caja, sin cuenta web.`,
    cliente: {
      id: creado.usuario.id,
      nombre,
      apellido,
      codigo,
      email: creado.usuario.email,
      rol: "cliente",
      telefono,
      direccion,
      cumpleanos,
      documento,
      nota,
      descuento,
      cuentaWeb,
      limiteAlmacen: cuentaCorriente ? limiteMercaderia : 0,
      limiteEfectivo: darCredito ? limiteCredito : 0,
    },
  };
}

export async function actualizarClienteCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("clientes"))) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const usuario = await buscarUsuarioPorId(id);
  if (!usuario || usuario.rol !== "cliente") return { error: "No encontramos ese cliente." };

  const nombre = texto(form, "nombre");
  const apellido = texto(form, "apellidos");
  const codigo = texto(form, "codigo");
  const telefono = texto(form, "telefono");
  const direccion = texto(form, "direccion");
  const cumpleanos = texto(form, "cumpleanos");
  const documento = texto(form, "documento");
  const nota = texto(form, "nota");
  const descuento = descuentoFicha(texto(form, "descuento")) ?? 0;
  const mail = texto(form, "email");
  const passwordWeb = texto(form, "password");
  const darCredito = String(form.get("credito") ?? "") === "1";
  const cuentaCorriente = String(form.get("cuentaCorriente") ?? "") === "1";
  const limiteCredito = monto(form, "limiteCredito");
  const limiteMercaderia = monto(form, "limiteMercaderia");
  const digitos = telefono.replace(/\D/g, "");
  const yaWeb = !usuario.email.endsWith("@mostrador.latriplel");
  const quiereWeb = !yaWeb && String(form.get("cuentaWeb") ?? "") === "1";

  if (nombre.length < 2) return { error: "Ingresá el nombre." };
  if (digitos.length < 8) return { error: "Ingresá un teléfono válido." };
  if (quiereWeb && !mail.includes("@")) return { error: "Para la cuenta web ingresá un mail." };
  if (quiereWeb || (yaWeb && passwordWeb)) {
    const errorClave = pinOPasswordValido(passwordWeb);
    if (errorClave) return { error: errorClave };
  }
  if (darCredito && limiteCredito < 1) return { error: "Ingresá el límite de crédito." };
  if (cuentaCorriente && limiteMercaderia < 1) {
    return { error: "Ingresá el límite de la cuenta corriente." };
  }
  const politica = politicaForm(form, darCredito, cuentaCorriente);
  if ("error" in politica) return politica;
  const condiciones = darCredito ? condicionesCredito(form) : null;
  if (condiciones && "error" in condiciones) return condiciones;

  const existentes = await listarUsuarios();
  if (
    codigo &&
    existentes.some(
      (u) => u.id !== id && (u.perfil?.codigo ?? "").toLowerCase() === codigo.toLowerCase(),
    )
  ) {
    return { error: "Ya hay un cliente con ese código." };
  }
  const doc = documento.replace(/\D/g, "");
  if (
    doc &&
    existentes.some(
      (u) => u.id !== id && (u.perfil?.documento ?? "").replace(/\D/g, "") === doc,
    )
  ) {
    return { error: "Ya hay un cliente con ese CUIT o DNI." };
  }

  const perfil = await actualizarPerfilUsuario(id, {
    nombre,
    notaInterna: nota,
    perfil: perfilMostrador({
      telefono,
      direccion,
      codigo,
      apellido,
      cumpleanos,
      documento,
      descuento,
    }),
  });
  if ("error" in perfil && perfil.error) return { error: perfil.error };

  let email = usuario.email;
  let cuentaWeb = yaWeb;
  if (quiereWeb) {
    const cambio = await cambiarEmailUsuario(id, mail);
    if ("error" in cambio) return { error: cambio.error };
    const clave = await cambiarPasswordUsuario(id, passwordWeb);
    if ("error" in clave) return { error: clave.error };
    await reasignarEmailFiado(email, cambio.email);
    email = cambio.email;
    cuentaWeb = true;
  } else if (yaWeb && passwordWeb) {
    const clave = await cambiarPasswordUsuario(id, passwordWeb);
    if ("error" in clave) return { error: clave.error };
  }

  const visible = [nombre, apellido].filter(Boolean).join(" ");
  await guardarLimitesCliente({
    email,
    nombre: visible,
    telefono,
    limiteAlmacen: cuentaCorriente ? limiteMercaderia : 0,
    limiteEfectivo: darCredito ? limiteCredito : 0,
  });
  await guardarPoliticaMora({
    email,
    nombre: visible,
    telefono,
    ...politica,
  });
  if (condiciones) {
    await guardarCondicionesCredito({ email, ...condiciones });
  }

  const tipo: TipoCuentaCliente = darCredito
    ? "linea_credito"
    : cuentaCorriente
      ? "credito_super"
      : descuento > 0
        ? "descuentos"
        : usuario.tipoCuenta === "descuentos"
          ? "descuentos"
          : "generico";
  await actualizarTipoCuenta(id, tipo);
  revalidar();

  const avisoWeb = quiereWeb
    ? " Ya puede entrar al catálogo con el mail y la contraseña."
    : cuentaWeb
      ? " Sigue entrando a la web con su mail."
      : " Sigue como cliente de caja, sin usuario web.";
  return {
    ok: `Actualizamos a ${visible}.${avisoWeb}`,
    cliente: {
      id,
      nombre,
      apellido,
      codigo,
      email,
      rol: "cliente",
      telefono,
      direccion,
      cumpleanos,
      documento,
      nota,
      descuento,
      cuentaWeb,
      limiteAlmacen: cuentaCorriente ? limiteMercaderia : 0,
      limiteEfectivo: darCredito ? limiteCredito : 0,
      moraCreditoModo: politica.moraCreditoModo,
      moraCreditoPorcentaje: politica.moraCreditoModo === "fijo" ? politica.moraCreditoPorcentaje : 0,
      moraCuentaModo: politica.moraCuentaModo,
      moraCuentaPorcentaje: politica.moraCuentaModo === "fijo" ? politica.moraCuentaPorcentaje : 0,
      moraModo: politica.moraCuentaModo,
      moraPorcentaje: politica.moraCuentaModo === "fijo" ? politica.moraCuentaPorcentaje : 0,
      plazoCuenta: politica.plazoCuenta ?? undefined,
      ...(condiciones
        ? {
            cuotasMaximas: condiciones.cuotasMaximas,
            cuotasHabilitadas: condiciones.cuotasHabilitadas,
            interesModo: condiciones.interesModo,
            interes1: condiciones.interes1,
            interes2: condiciones.interes2,
            interes3: condiciones.interes3,
            interes6: condiciones.interes6,
          }
        : {}),
    },
  };
}

export async function guardarMedioPagoCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("mantenimiento"))) return { error: "No podés cargar medios de pago." };
  const resultado = await guardarMedioPago({
    nombre: texto(form, "nombre"),
    efectivo: form.get("efectivo") === "1",
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Cargamos el medio de pago ${resultado.nombre}.` };
}

export async function quitarMedioPagoCaja(form: FormData): Promise<EstadoDeposito> {
  if (!(await sesionCaja("mantenimiento"))) return { error: "No podés quitar medios de pago." };
  const resultado = await quitarMedioPago(texto(form, "id"));
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Quitamos ${resultado.nombre}.` };
}

export async function cargarEmpleadoCaja(form: FormData): Promise<EstadoDeposito> {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return { error: "Solo administración puede cargar empleados." };
  }
  const nombre = texto(form, "nombre");
  const telefono = texto(form, "telefono");
  const mail = texto(form, "email");
  const pin = texto(form, "pin");
  const digitos = telefono.replace(/\D/g, "");
  const errorPin = pinOPasswordValido(pin);
  if (errorPin) return { error: errorPin };
  if (!mail.includes("@") && digitos.length < 8) {
    return { error: "Ingresá un mail o un teléfono para que pueda entrar." };
  }
  const permisos = leerPermisosForm(form);
  if (permisos.length < 1) return { error: "Elegí al menos una parte del menú de caja." };
  const email = mail.includes("@") ? mail : `${digitos}@caja.latriplel`;
  const creado = await crearUsuarioAdmin({
    email,
    nombre,
    password: pin,
    rol: "caja",
    permisosCaja: permisos,
  });
  if ("error" in creado) return { error: creado.error };
  const perfil = await actualizarPerfilUsuario(creado.usuario.id, {
    nombre,
    perfil: {
      ...perfilMostrador({
        telefono: digitos.length >= 8 ? telefono : "",
        direccion: "Garay 1005",
        codigo: "",
        apellido: "",
        cumpleanos: "",
        documento: "",
      }),
      tipoLocal: "Empleado de caja",
      productosInteres: "Caja",
    },
  });
  if ("error" in perfil) return { error: perfil.error };
  revalidar();
  return {
    ok: `Cargamos a ${nombre} como caja. Entra con ${mail.includes("@") ? "el mail" : "el teléfono"} y el PIN.`,
  };
}

export async function guardarPermisosEmpleadoCaja(form: FormData): Promise<EstadoDeposito> {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") return { error: "Solo administración puede cambiar permisos." };
  const resultado = await guardarPermisosCaja(texto(form, "id"), leerPermisosForm(form));
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Actualizamos el menú de ${resultado.usuario.nombre}.` };
}
