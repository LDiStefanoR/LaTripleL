"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import {
  guardarAliasCliente,
  informarPagoCliente,
  solicitarEfectivo,
  resumenPorEmail,
  actualizarContactoFiado,
} from "@/lib/cuentas";
import { guardarFotoSitio } from "@/lib/fotos-sitio";
import { getSesion } from "@/lib/sesion";
import { parseTipoCuenta, tieneLineaCredito } from "@/lib/tipo-cuenta";
import { actualizarContactoCliente, buscarUsuarioPorEmail, cambiarPasswordUsuario } from "@/lib/usuarios";
import { whatsappUrl } from "@/lib/whatsapp";
import { formatoPesos } from "@/lib/format";

export type EstadoCuentaCliente = {
  error?: string;
  ok?: string;
  whatsapp?: string;
} | null;

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

function revalidar() {
  revalidatePath("/cuenta");
  revalidatePath("/admin/cuentas");
  revalidatePath("/", "layout");
}

async function exigirCliente() {
  const sesion = await getSesion();
  return sesion && sesion.rol !== "admin" ? sesion : null;
}

async function comprobanteDesdeForm(form: FormData) {
  const archivo = form.get("comprobante");
  if (!(archivo instanceof File) || archivo.size === 0) return "";
  if (archivo.size > 4 * 1024 * 1024) {
    return { error: "El comprobante no puede pesar más de 4 MB." as const };
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
      nombre: `comp-${Date.now()}${ext}`,
      buffer,
      mime: archivo.type,
    });
  } catch (error) {
    console.error("[comprobante]", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el comprobante.",
    };
  }
}

export async function clienteSolicitarEfectivo(
  _prev: EstadoCuentaCliente,
  form: FormData,
): Promise<EstadoCuentaCliente> {
  const sesion = await exigirCliente();
  if (!sesion) return { error: "Ingresá con tu cuenta de cliente." };
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!tieneLineaCredito(parseTipoCuenta(usuario?.tipoCuenta))) {
    return { error: "Tu cuenta no tiene línea de crédito habilitada." };
  }
  const monto = Number(texto(form, "monto").replace(/\./g, "").replace(",", "."));
  const aliasCbu = texto(form, "aliasCbu");
  const resultado = await solicitarEfectivo({
    email: sesion.email,
    monto,
    aliasCbu,
    nota: texto(form, "nota"),
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  const mensaje = `Hola, soy ${resultado.cliente.nombre}. Solicito un préstamo en efectivo de ${formatoPesos(monto)}. Alias/CBU: ${aliasCbu}. El plazo de acreditación es de ${resultado.plazoHoras} horas.`;
  return {
    ok: `Pedimos el efectivo. El plazo de acreditación es de ${resultado.plazoHoras} horas. El administrador ya tiene la alerta.`,
    whatsapp: whatsappUrl(mensaje),
  };
}

export async function clienteInformarPago(
  _prev: EstadoCuentaCliente,
  form: FormData,
): Promise<EstadoCuentaCliente> {
  const sesion = await exigirCliente();
  if (!sesion) return { error: "Ingresá con tu cuenta de cliente." };
  const monto = Number(texto(form, "monto").replace(/\./g, "").replace(",", "."));
  const comprobante = await comprobanteDesdeForm(form);
  if (typeof comprobante === "object") return { error: comprobante.error };
  const medio = texto(form, "medio") || "transferencia";
  const resultado = await informarPagoCliente({
    email: sesion.email,
    monto,
    medio,
    nota: texto(form, "nota"),
    comprobante,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  const mensaje = `Hola, soy ${resultado.cliente.nombre}. Informo que ya pagué ${formatoPesos(monto)} (${medio}). ${texto(form, "nota")}`.trim();
  return {
    ok: "Avisamos al administrador. Cuando confirme el pago, se descuenta de tu saldo.",
    whatsapp: whatsappUrl(mensaje),
  };
}

export async function clienteGuardarAlias(
  _prev: EstadoCuentaCliente,
  form: FormData,
): Promise<EstadoCuentaCliente> {
  const sesion = await exigirCliente();
  if (!sesion) return { error: "Ingresá con tu cuenta de cliente." };
  const resumen = await resumenPorEmail(sesion.email);
  if (!resumen) return { error: "Todavía no tenés cuenta corriente." };
  const resultado = await guardarAliasCliente(
    resumen.resumen.cliente.id,
    texto(form, "aliasCbu"),
  );
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Guardamos tu alias o CBU." };
}

export async function clienteActualizarPerfil(
  _prev: EstadoCuentaCliente,
  form: FormData,
): Promise<EstadoCuentaCliente> {
  const sesion = await exigirCliente();
  if (!sesion) return { error: "Ingresá con tu cuenta de cliente." };
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!usuario) return { error: "No encontramos tu usuario." };
  let foto = usuario.perfil?.fotoPerfil;
  const archivo = form.get("foto");
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > 4 * 1024 * 1024) {
      return { error: "La foto no puede pesar más de 4 MB." };
    }
    const tipos: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };
    const ext = tipos[archivo.type];
    if (!ext) return { error: "Usá una foto JPG, PNG o WebP." };
    const buffer = Buffer.from(await archivo.arrayBuffer());
    try {
      foto = await guardarFotoSitio({
        carpeta: "web",
        nombre: `perfil-${usuario.id}${ext}`,
        buffer,
        mime: archivo.type,
      });
    } catch (error) {
      console.error("[foto-perfil]", error);
      return { error: "No se pudo guardar la foto de perfil." };
    }
  }
  const franja = texto(form, "franjaReparto");
  const resultado = await actualizarContactoCliente(usuario.id, {
    nombre: texto(form, "nombre") || usuario.nombre,
    telefono: texto(form, "telefono"),
    direccion: texto(form, "direccion"),
    franjaReparto: franja === "tarde" || franja === "manana" ? franja : undefined,
    fotoPerfil: foto,
  });
  if ("error" in resultado) return { error: resultado.error };
  await actualizarContactoFiado(sesion.email, {
    telefono: texto(form, "telefono"),
    nombre: texto(form, "nombre") || usuario.nombre,
  });
  if (form.has("aliasCbu")) {
    const vinculo = await resumenPorEmail(sesion.email);
    if (!vinculo && texto(form, "aliasCbu")) {
      return { error: "El local todavía no te habilitó la cuenta para cargar un alias." };
    }
    if (vinculo) {
      const alias = await guardarAliasCliente(vinculo.resumen.cliente.id, texto(form, "aliasCbu"));
      if ("error" in alias) return { error: alias.error };
    }
  }
  revalidar();
  return { ok: "Guardamos tus datos." };
}

export async function clienteCambiarClave(
  _prev: EstadoCuentaCliente,
  form: FormData,
): Promise<EstadoCuentaCliente> {
  const sesion = await exigirCliente();
  if (!sesion) return { error: "Ingresá con tu cuenta de cliente." };
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!usuario) return { error: "No encontramos tu usuario." };
  const actual = texto(form, "actual");
  const nueva = texto(form, "password");
  const repetir = texto(form, "repetir");
  if (nueva !== repetir) return { error: "La contraseña nueva no coincide las dos veces." };
  const coincide = await bcrypt.compare(actual, usuario.passwordHash);
  if (!coincide) return { error: "La contraseña actual no es correcta." };
  const resultado = await cambiarPasswordUsuario(usuario.id, nueva);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Actualizamos tu contraseña." };
}
