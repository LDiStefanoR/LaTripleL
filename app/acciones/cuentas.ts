"use server";

import { revalidatePath } from "next/cache";
import { cambiarEstadoPedido, listarPedidos, ajustarMontoRecarga, resolverRecarga } from "@/lib/pedidos";
import { puedeCobrar } from "@/lib/roles";
import { quitarFiadoPorEmail } from "@/lib/cuentas";
import { getSesion } from "@/lib/sesion";
import {
  actualizarPerfilUsuario,
  actualizarTipoCuenta,
  buscarUsuarioPorId,
  cambiarEmailUsuario,
  cambiarEstadoCuenta,
  cambiarPasswordUsuario,
  cambiarRolUsuario,
  crearUsuarioAdmin,
  eliminarUsuario,
  listarUsuarios,
} from "@/lib/usuarios";
import type { EstadoCuenta, PerfilCliente, RolUsuario, TipoPersona } from "@/types/auth";
import type { EstadoPedido } from "@/types/pedido";

export type EstadoAdminCuentas = { error?: string; ok?: string } | null;

async function exigirAdmin() {
  const sesion = await getSesion();
  return sesion?.rol === "admin" ? sesion : null;
}

export async function contarAlertasAdmin() {
  const sesion = await getSesion();
  if (!sesion || !puedeCobrar(sesion.rol)) {
    return { solicitudes: 0, pedidosNuevos: 0, novedades: 0, total: 0 };
  }
  const { contarNovedadesPendientes } = await import("@/lib/cuentas");
  const [usuarios, pedidos, novedades] = await Promise.all([
    listarUsuarios(),
    listarPedidos(),
    contarNovedadesPendientes(),
  ]);
  const pedidosNuevos = pedidos.filter((p) => !p.esRecarga && p.estado === "sin_atender").length;
  if (sesion.rol !== "admin") {
    return { solicitudes: 0, pedidosNuevos, novedades: 0, total: pedidosNuevos };
  }
  const solicitudes = usuarios.filter((u) => u.estado === "pendiente").length;
  return {
    solicitudes,
    pedidosNuevos,
    novedades,
    total: solicitudes + pedidosNuevos + novedades,
  };
}

function revalidar() {
  revalidatePath("/admin/clientes", "layout");
  revalidatePath("/admin/cuentas", "layout");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/catalogo");
  revalidatePath("/cuenta");
  revalidatePath("/", "layout");
}

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

export async function adminCambiarEstadoPedido(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const estado = texto(form, "estado") as EstadoPedido;
  if (!["sin_atender", "en_proceso", "enviando", "terminado"].includes(estado)) {
    return { error: "Estado no válido." };
  }
  const resultado = await cambiarEstadoPedido(id, estado);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Actualizamos el estado del pedido." };
}

export async function adminResolverRecarga(form: FormData): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const acreditar = texto(form, "acreditar") === "1";
  const id = texto(form, "id");
  if (acreditar) {
    const monto = Math.round(Number(String(form.get("monto") ?? "").replace(/[^\d]/g, "")));
    if (monto > 0) {
      const ajuste = await ajustarMontoRecarga(id, monto);
      if ("error" in ajuste) return { error: ajuste.error };
    }
  }
  const resultado = await resolverRecarga(id, acreditar);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok: acreditar
      ? `Acreditamos ${resultado.pedido.total} al saldo de ${resultado.pedido.contacto.nombre}.`
      : "Rechazamos la recarga. El saldo no cambió.",
  };
}

export async function adminResolverCredito(form: FormData): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const { resolverCreditoSolicitado } = await import("@/lib/cuentas");
  const aceptar = texto(form, "aceptar") === "1";
  const monto = Math.round(Number(String(form.get("monto") ?? "").replace(/[^\d]/g, "")));
  const resultado = await resolverCreditoSolicitado({
    solicitudId: texto(form, "id"),
    monto,
    aceptar,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok: aceptar
      ? `Aceptamos el crédito${resultado.nombre ? ` de ${resultado.nombre}` : ""}. Quedó como deuda en efectivo.`
      : "Rechazamos el crédito. No se generó deuda.",
  };
}

export async function adminCambiarEstadoCuenta(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const estado = texto(form, "estado") as EstadoCuenta;
  if (!["pendiente", "activa", "rechazada"].includes(estado)) {
    return { error: "Estado no válido." };
  }
  const resultado = await cambiarEstadoCuenta(id, estado);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  const mensaje =
    estado === "activa"
      ? "Aceptamos la cuenta. Ya puede ingresar."
      : estado === "rechazada"
        ? "Rechazamos la solicitud."
        : "Actualizamos el estado de la cuenta.";
  return { ok: mensaje };
}

export async function adminCambiarRol(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const rol = texto(form, "rol") as RolUsuario;
  if (rol !== "admin" && rol !== "cliente" && rol !== "caja") {
    return { error: "Permiso no válido." };
  }
  const resultado = await cambiarRolUsuario(id, rol);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok:
      rol === "admin"
        ? "Ahora tiene permiso de administrador."
        : rol === "caja"
          ? "Ahora puede cobrar en la caja."
          : "Ahora tiene permiso general (cliente).",
  };
}

export async function adminCambiarPassword(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await cambiarPasswordUsuario(
    texto(form, "id"),
    texto(form, "password"),
  );
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Actualizamos la contraseña." };
}

export async function adminCambiarEmail(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await cambiarEmailUsuario(
    texto(form, "id"),
    texto(form, "email"),
  );
  if ("error" in resultado) return { error: resultado.error };
  const { actualizarEmailClienteFiado } = await import("@/lib/cuentas");
  await actualizarEmailClienteFiado(resultado.anterior, resultado.email);
  revalidar();
  revalidatePath("/cuenta");
  return { ok: `El mail quedó en ${resultado.email}.` };
}

export async function adminCrearUsuario(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const rol = texto(form, "rol") as RolUsuario;
  const { parseTipoCuenta, tieneCreditoSuper, tieneLineaCredito } = await import(
    "@/lib/tipo-cuenta"
  );
  const tipo = parseTipoCuenta(texto(form, "tipoCuenta"));
  const resultado = await crearUsuarioAdmin({
    email: texto(form, "email"),
    nombre: texto(form, "nombre"),
    password: texto(form, "password"),
    rol: rol === "admin" ? "admin" : "cliente",
    tipoCuenta: tipo,
  });
  if ("error" in resultado) return { error: resultado.error };
  if (resultado.usuario.rol === "cliente") {
    const { asegurarClienteCredito } = await import("@/lib/cuentas");
    await asegurarClienteCredito({
      email: resultado.usuario.email,
      nombre: resultado.usuario.nombre,
      telefono: resultado.usuario.perfil?.telefono ?? "",
      limiteAlmacen: 0,
      limiteEfectivo: 0,
      credito: tieneCreditoSuper(tipo) || tieneLineaCredito(tipo),
    });
  }
  revalidar();
  return { ok: `Creamos la cuenta de ${resultado.usuario.email}.` };
}

export async function adminEliminarUsuario(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  const sesion = await exigirAdmin();
  if (!sesion) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const usuario = await buscarUsuarioPorId(id);
  const resultado = await eliminarUsuario(id, sesion.email);
  if ("error" in resultado) return { error: resultado.error };
  if (usuario?.rol === "cliente") await quitarFiadoPorEmail(usuario.email);
  revalidar();
  return { ok: "Eliminamos la cuenta." };
}

export async function adminGuardarPerfil(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const tipo = texto(form, "tipoPersona") as TipoPersona;
  const franja = texto(form, "franjaReparto");
  const perfil: PerfilCliente = {
    tipoPersona: tipo === "empresa" ? "empresa" : "persona",
    tipoLocal: texto(form, "tipoLocal"),
    productosInteres: texto(form, "productosInteres"),
    direccion: texto(form, "direccion"),
    telefono: texto(form, "telefono"),
    horarioAtencion: texto(form, "horarioAtencion"),
    deseaAsesor: false,
    franjaReparto: franja === "tarde" || franja === "manana" ? franja : undefined,
  };
  const resultado = await actualizarPerfilUsuario(texto(form, "id"), {
    nombre: texto(form, "nombre"),
    perfil,
    notaInterna: texto(form, "notaInterna"),
  });
  if ("error" in resultado) return { error: resultado.error };
  const { asegurarFichaCliente, actualizarContactoFiado } = await import(
    "@/lib/cuentas"
  );
  if (resultado.usuario.rol === "cliente") {
    await asegurarFichaCliente({
      email: resultado.usuario.email,
      nombre: resultado.usuario.nombre,
      telefono: perfil.telefono,
    });
  }
  await actualizarContactoFiado(resultado.usuario.email, {
    telefono: perfil.telefono,
    nombre: resultado.usuario.nombre,
  });
  revalidar();
  return { ok: "Guardamos la ficha." };
}

export async function adminGuardarCreditoCliente(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const { parseTipoCuenta, mensajeGuardarTipo, tieneCreditoSuper, tieneLineaCredito } =
    await import("@/lib/tipo-cuenta");
  const id = texto(form, "id");
  const tipo = parseTipoCuenta(texto(form, "tipoCuenta"));
  const usuarios = await listarUsuarios();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos ese cliente." };
  const resultado = await actualizarTipoCuenta(id, tipo);
  if ("error" in resultado) return { error: resultado.error };
  const monto = Number(texto(form, "montoCredito").replace(/\./g, "").replace(",", ".")) || 0;
  const { asegurarClienteCredito } = await import("@/lib/cuentas");
  await asegurarClienteCredito({
    email: usuario.email,
    nombre: usuario.nombre,
    telefono: usuario.perfil?.telefono ?? "",
    limiteAlmacen: tieneCreditoSuper(tipo) ? monto : 0,
    limiteEfectivo: tieneLineaCredito(tipo) ? monto : 0,
    credito: tieneCreditoSuper(tipo) || tieneLineaCredito(tipo),
  });
  revalidar();
  revalidatePath("/cuenta");
  revalidatePath("/catalogo");
  revalidatePath("/admin/cuentas");
  return { ok: mensajeGuardarTipo(tipo) };
}
