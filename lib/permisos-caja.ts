export const PERMISOS_CAJA = [
  "venta",
  "listados",
  "stock",
  "clientes",
  "productos",
  "mantenimiento",
  "deudas",
] as const;

export type PermisoCaja = (typeof PERMISOS_CAJA)[number];

export const ETIQUETA_PERMISO_CAJA: Record<PermisoCaja, string> = {
  venta: "Caja / Ventas",
  listados: "Listados",
  stock: "Stock",
  clientes: "Clientes",
  productos: "Productos",
  mantenimiento: "Mantenimiento",
  deudas: "Deudas",
};

const BASE_CAJA: PermisoCaja[] = [
  "venta",
  "listados",
  "stock",
  "clientes",
  "productos",
  "mantenimiento",
];

export function esPermisoCaja(valor: unknown): valor is PermisoCaja {
  return PERMISOS_CAJA.includes(valor as PermisoCaja);
}

export function permisosCajaDe(rol: string, guardados?: readonly string[] | null): PermisoCaja[] {
  if (rol === "admin") return [...PERMISOS_CAJA];
  if (!guardados) return [...BASE_CAJA];
  return PERMISOS_CAJA.filter((permiso) => guardados.includes(permiso));
}

export function leerPermisosForm(form: FormData): PermisoCaja[] {
  return PERMISOS_CAJA.filter((permiso) => form.get(`permiso_${permiso}`) === "1");
}
