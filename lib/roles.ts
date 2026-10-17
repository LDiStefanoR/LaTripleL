import type { RolUsuario } from "@/types/auth";

export function rutaPorRol(rol: RolUsuario) {
  if (rol === "admin") return "/caja";
  if (rol === "caja") return "/caja";
  return "/cuenta";
}

export function puedeCobrar(rol?: string | null) {
  return rol === "admin" || rol === "caja";
}
