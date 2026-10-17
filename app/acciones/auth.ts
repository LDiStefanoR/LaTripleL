"use server";

import { redirect } from "next/navigation";
import { borrarSesion, guardarSesion } from "@/lib/sesion";
import {
  buscarUsuarioPorEmail,
  asegurarAdminConClave,
  solicitarCuenta,
  verificarPassword,
} from "@/lib/usuarios";
import {
  cantidadCuentasPorTelefono,
  resolverLogin,
  sincronizarUsuariosCuenta,
} from "@/lib/cuentas";
import { PASSWORD_ADMIN_SEMILLA } from "@/lib/auth-config";
import { rutaPorRol } from "@/lib/roles";
import { ETIQUETA_FRANJA } from "@/types/pedido";
import type { PerfilCliente, TipoPersona } from "@/types/auth";

export type EstadoAuth = { error?: string; ok?: string } | null;

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

function perfilDesdeForm(form: FormData): PerfilCliente {
  const tipo = texto(form, "tipoPersona") as TipoPersona;
  const franja = texto(form, "franjaReparto");
  const franjaReparto = franja === "tarde" || franja === "manana" ? franja : undefined;
  return {
    tipoPersona: tipo === "empresa" ? "empresa" : "persona",
    tipoLocal: texto(form, "tipoLocal"),
    productosInteres: texto(form, "productosInteres"),
    direccion: texto(form, "direccion"),
    telefono: texto(form, "telefono"),
    horarioAtencion: franjaReparto ? ETIQUETA_FRANJA[franjaReparto] : "",
    deseaAsesor: false,
    franjaReparto,
  };
}

export async function ingresar(
  _prev: EstadoAuth,
  form: FormData,
): Promise<EstadoAuth> {
  const login = texto(form, "login") || texto(form, "email");
  const password = texto(form, "password");
  const recordar = texto(form, "recordar") === "1";
  if (!login || !password) {
    return { error: "Completá teléfono o mail, y tu PIN o contraseña." };
  }
  if (!login.includes("@") && (await cantidadCuentasPorTelefono(login)) > 1) {
    return {
      error: "Hay varias cuentas con ese teléfono. Entrá con el mail.",
    };
  }
  await sincronizarUsuariosCuenta();
  const resuelto = await resolverLogin(login);
  let usuario = await buscarUsuarioPorEmail(resuelto || login);
  const claveOk =
    usuario && (await verificarPassword(usuario, password));
  if (!claveOk) {
    const esAdmin =
      login.replace(/\s+/g, "").toLowerCase().includes("digitalpre");
    if (esAdmin && password === PASSWORD_ADMIN_SEMILLA) {
      usuario = await asegurarAdminConClave(password);
    } else {
      usuario = null;
    }
  }
  if (!usuario) {
    return { error: "Teléfono, mail o PIN incorrectos." };
  }
  if (usuario.estado === "pendiente") {
    return {
      error:
        "Tu solicitud todavía no fue aceptada. Cuando el administrador la apruebe vas a poder ingresar.",
    };
  }
  if (usuario.estado === "rechazada") {
    return {
      error:
        "Tu solicitud no fue aceptada. Escribinos por WhatsApp si querés más información.",
    };
  }
  try {
    await guardarSesion(
      {
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
      { recordar },
    );
  } catch (error) {
    console.error("[auth] No se pudo crear la sesión", error);
    return {
      error:
        "No se pudo iniciar sesión. En Vercel tiene que estar cargada la variable AUTH_SECRET.",
    };
  }
  redirect(rutaPorRol(usuario.rol));
}

export async function registrar(
  _prev: EstadoAuth,
  form: FormData,
): Promise<EstadoAuth> {
  const password = texto(form, "password");
  const repetir = texto(form, "repetir");
  if (password !== repetir) {
    return { error: "Las contraseñas no coinciden." };
  }
  const franja = texto(form, "franjaReparto");
  if (franja !== "manana" && franja !== "tarde") {
    return { error: "Elegí la franja de entrega: mañana (9 a 13) o tarde (18 a 20)." };
  }
  const resultado = await solicitarCuenta({
    nombre: texto(form, "nombre"),
    email: texto(form, "email"),
    password,
    perfil: perfilDesdeForm(form),
  });
  if ("error" in resultado) return { error: resultado.error };
  return {
    ok: "Recibimos tu solicitud. Cuando el administrador la acepte vas a poder ingresar con tu mail y contraseña.",
  };
}

export async function salir() {
  await borrarSesion();
  redirect("/");
}
