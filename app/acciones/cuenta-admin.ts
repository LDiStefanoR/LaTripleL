"use server";

import { revalidatePath } from "next/cache";
import {
  actualizarLimites,
  actualizarPinInicial,
  actualizarTicket,
  agregarClienteFiado,
  agregarTicket,
  atenderSolicitud,
  guardarAjustesCuenta,
  marcarDeudaTotalPagada,
  marcarNovedadesLeidas,
  marcarTicketPagado,
  registrarPagoParcial,
} from "@/lib/cuentas";
import { cambiarPasswordUsuario, listarUsuarios } from "@/lib/usuarios";
import { getSesion } from "@/lib/sesion";
import { normalizarEmail } from "@/lib/usuarios";
import { guardarFotoSitio } from "@/lib/fotos-sitio";
import type { TipoTicket } from "@/types/cuenta";

export type EstadoCuentaAdmin = { error?: string; ok?: string } | null;

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

function numero(form: FormData, campo: string) {
  return Number(texto(form, campo).replace(/\./g, "").replace(",", ".")) || 0;
}

function revalidar() {
  revalidatePath("/cuenta");
  revalidatePath("/admin/cuentas");
  revalidatePath("/admin/cuentas", "layout");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

async function exigirAdmin() {
  const sesion = await getSesion();
  return sesion?.rol === "admin" ? sesion : null;
}

async function adjuntoDesdeForm(form: FormData, campo = "adjunto") {
  const archivo = form.get(campo);
  if (!(archivo instanceof File) || archivo.size === 0) return "";
  if (archivo.size > 4 * 1024 * 1024) {
    return { error: "El ticket no puede pesar más de 4 MB." as const };
  }
  const tipos: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
  };
  const ext = tipos[archivo.type];
  if (!ext) return { error: "Adjuntá una foto JPG/PNG/WebP o un PDF." as const };
  const buffer = Buffer.from(await archivo.arrayBuffer());
  try {
    return await guardarFotoSitio({
      carpeta: "web",
      nombre: `ticket-${Date.now()}${ext}`,
      buffer,
      mime: archivo.type,
    });
  } catch (error) {
    console.error("[ticket-adjunto]", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la foto del ticket.",
    };
  }
}

export async function adminMarcarTicketPagado(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await marcarTicketPagado(
    texto(form, "ticketId"),
    texto(form, "nota"),
  );
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "El ticket quedó pagado y desaparece del saldo del cliente." };
}

export async function adminMarcarDeudaTotal(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await marcarDeudaTotalPagada(
    texto(form, "clienteId"),
    texto(form, "nota"),
  );
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Toda la deuda vigente quedó pagada." };
}

export async function adminPagoParcial(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await registrarPagoParcial({
    clienteId: texto(form, "clienteId"),
    ticketId: texto(form, "ticketId") || undefined,
    monto: numero(form, "monto"),
    nota: texto(form, "nota"),
    medio: texto(form, "medio") || "admin",
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Imputamos un pago de ${resultado.aplicado}.` };
}

export async function adminGuardarLimites(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await actualizarLimites({
    clienteId: texto(form, "clienteId"),
    limiteAlmacen: numero(form, "limiteAlmacen"),
    limiteEfectivo: numero(form, "limiteEfectivo"),
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Actualizamos los límites de este cliente." };
}

export async function adminGuardarTicket(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const adjunto = await adjuntoDesdeForm(form);
  if (typeof adjunto === "object") return { error: adjunto.error };
  const tipo = texto(form, "tipo") as TipoTicket;
  const medio = texto(form, "medioPago");
  const interesOff = texto(form, "interesDesactivado") === "1";
  const interesManualTxt = texto(form, "interesManual");
  const resultado = await actualizarTicket({
    ticketId: texto(form, "ticketId"),
    numero: texto(form, "numero") || undefined,
    descripcion: texto(form, "descripcion") || undefined,
    tipo: tipo === "efectivo" ? "efectivo" : tipo === "almacen" ? "almacen" : undefined,
    medioPago:
      medio === "local" ||
      medio === "transferencia" ||
      medio === "cuenta" ||
      medio === "web"
        ? medio
        : undefined,
    total: texto(form, "total") ? numero(form, "total") : undefined,
    debe: texto(form, "debe") ? numero(form, "debe") : undefined,
    vencimiento: texto(form, "vencimiento") || undefined,
    adjunto: adjunto || undefined,
    interesDesactivado: texto(form, "interesDesactivado") ? interesOff : undefined,
    interesManual: interesOff
      ? null
      : interesManualTxt
        ? numero(form, "interesManual")
        : texto(form, "interesAuto") === "1"
          ? null
          : undefined,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Guardamos el movimiento." };
}

export async function adminAgregarTicket(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const adjunto = await adjuntoDesdeForm(form);
  if (typeof adjunto === "object") return { error: adjunto.error };
  const tipo = texto(form, "tipo") as TipoTicket;
  const total = numero(form, "total");
  const cobro = texto(form, "cobro");
  const pagado = numero(form, "pagado");
  let debe = total;
  if (cobro === "pagado") debe = 0;
  else if (cobro === "parcial") debe = Math.max(0, total - pagado);
  const medio = texto(form, "medioPago");
  const resultado = await agregarTicket({
    clienteId: texto(form, "clienteId"),
    numero: texto(form, "numero") || undefined,
    fecha: texto(form, "fecha") || undefined,
    vencimiento: texto(form, "vencimiento") || undefined,
    descripcion: texto(form, "descripcion") || undefined,
    tipo: tipo === "efectivo" ? "efectivo" : "almacen",
    medioPago:
      medio === "local" || medio === "transferencia" || medio === "cuenta"
        ? medio
        : cobro === "pagado" || cobro === "parcial"
          ? "local"
          : "cuenta",
    total,
    debe,
    adjunto: adjunto || undefined,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Cargamos el ticket ${resultado.ticket.numero}.` };
}

export async function adminGuardarAjustesCuenta(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  await guardarAjustesCuenta({
    alias: texto(form, "alias"),
    cbu: texto(form, "cbu"),
    titular: texto(form, "titular"),
    banco: texto(form, "banco"),
    limiteAlmacenDefault: numero(form, "limiteAlmacenDefault") || 50000,
    limiteEfectivoDefault: numero(form, "limiteEfectivoDefault"),
    plazoEfectivoHoras: numero(form, "plazoEfectivoHoras") || 48,
  });
  revalidar();
  return { ok: "Guardamos alias, CBU y límites por defecto." };
}

export async function adminAgregarClienteFiado(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await agregarClienteFiado({
    nombre: texto(form, "nombre"),
    telefono: texto(form, "telefono"),
    limiteAlmacen: numero(form, "limiteAlmacen") || undefined,
    limiteEfectivo: numero(form, "limiteEfectivo") || undefined,
    pin: texto(form, "pin") || undefined,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok: `Creamos a ${resultado.cliente.nombre}. Mail ${resultado.cliente.email} · PIN ${resultado.cliente.pinInicial}.`,
  };
}

export async function adminResetPinCliente(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const pin = texto(form, "pin");
  const email = texto(form, "email");
  const usuarios = await listarUsuarios();
  const usuario = usuarios.find((u) => u.email === normalizarEmail(email));
  if (!usuario) return { error: "Ese cliente todavía no tiene usuario de ingreso." };
  const resultado = await cambiarPasswordUsuario(usuario.id, pin);
  if ("error" in resultado) return { error: resultado.error };
  await actualizarPinInicial(texto(form, "clienteId"), pin);
  revalidar();
  return { ok: "Actualizamos el PIN de ingreso." };
}

export async function adminAtenderSolicitud(
  form: FormData,
): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const estado = texto(form, "estado");
  if (estado !== "atendida" && estado !== "rechazada") {
    return { error: "Estado no válido." };
  }
  const resultado = await atenderSolicitud(texto(form, "solicitudId"), estado);
  if ("error" in resultado) return { error: resultado.error };
  if (estado === "atendida" && texto(form, "imputar") === "1") {
    const parcial = await registrarPagoParcial({
      clienteId: texto(form, "clienteId"),
      monto: numero(form, "monto"),
      nota: "Pago informado por el cliente, confirmado",
      medio: "aviso-cliente",
    });
    if ("error" in parcial) return { error: parcial.error };
  }
  revalidar();
  return {
    ok:
      estado === "atendida"
        ? "Listo, quedó registrada la atención."
        : "Rechazamos la solicitud.",
  };
}

export async function adminMarcarNovedadesLeidas(): Promise<EstadoCuentaAdmin> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  await marcarNovedadesLeidas();
  revalidar();
  return { ok: "Marcamos las novedades como vistas." };
}
