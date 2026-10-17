import { permisosCajaDe, type PermisoCaja } from "@/lib/permisos-caja";
import { puedeCobrar } from "@/lib/roles";
import { getSesion } from "@/lib/sesion";
import { buscarUsuarioPorEmail } from "@/lib/usuarios";

export async function exigirPermisoCaja(permiso: PermisoCaja) {
  const sesion = await getSesion();
  if (!sesion || !puedeCobrar(sesion.rol)) return null;
  if (sesion.rol === "admin") return sesion;
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  const lista = permisosCajaDe(sesion.rol, usuario?.permisosCaja);
  return lista.includes(permiso) ? sesion : null;
}
