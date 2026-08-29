import { cookies } from "next/headers";
import { COOKIE_SESION } from "@/lib/auth-config";
import { firmarSesion, leerSesionToken } from "@/lib/sesion-token";
import type { SesionPublica } from "@/types/auth";

export { leerSesionToken, firmarSesion };

export async function getSesion(): Promise<SesionPublica | null> {
  const jar = await cookies();
  const base = await leerSesionToken(jar.get(COOKIE_SESION)?.value);
  if (!base || base.rol !== "cliente") return base;
  const { buscarUsuarioPorEmail } = await import("@/lib/usuarios");
  const { parseTipoCuenta } = await import("@/lib/tipo-cuenta");
  const usuario = await buscarUsuarioPorEmail(base.email);
  if (!usuario) return base;
  return { ...base, tipoCuenta: parseTipoCuenta(usuario.tipoCuenta) };
}

export async function guardarSesion(
  datos: SesionPublica,
  opciones?: { recordar?: boolean },
) {
  const token = await firmarSesion(datos);
  const jar = await cookies();
  const recordar = opciones?.recordar ?? false;
  jar.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    ...(recordar ? { maxAge: 60 * 60 * 24 * 30 } : {}),
    secure: process.env.NODE_ENV === "production",
  });
}

export async function borrarSesion() {
  const jar = await cookies();
  jar.set(COOKIE_SESION, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  jar.delete(COOKIE_SESION);
}
