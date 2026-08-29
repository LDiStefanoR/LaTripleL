import { SignJWT, jwtVerify } from "jose";
import { secretSesion } from "@/lib/auth-config";
import type { RolUsuario, SesionPublica } from "@/types/auth";

const encoder = new TextEncoder();

function clave() {
  return encoder.encode(secretSesion());
}

export async function firmarSesion(datos: SesionPublica) {
  return new SignJWT({
    email: datos.email,
    nombre: datos.nombre,
    rol: datos.rol,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(clave());
}

export async function leerSesionToken(
  token: string | undefined,
): Promise<SesionPublica | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    const email = String(payload.email ?? "");
    const nombre = String(payload.nombre ?? "");
    const rol = payload.rol as RolUsuario;
    if (!email || (rol !== "admin" && rol !== "cliente")) return null;
    return { email, nombre, rol };
  } catch {
    return null;
  }
}
