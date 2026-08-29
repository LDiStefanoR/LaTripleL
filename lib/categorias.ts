export const SECCIONES = [
  "ALMACEN GENERAL",
  "BEBIDAS",
  "GALLETAS",
  "LIMPIEZA E HIGENE",
  "CIGARRILLOS",
  "VAPERS",
  "ELECTRONICA",
  "TECNOLOGIA",
  "OTROS",
  "VARIOS",
] as const;

export type SeccionProducto = (typeof SECCIONES)[number];

export const SECCION_LABEL: Record<string, string> = {
  "ALMACEN GENERAL": "Almacén",
  BEBIDAS: "Bebidas",
  GALLETAS: "Galletas",
  "LIMPIEZA E HIGENE": "Limpieza e higiene",
  CIGARRILLOS: "Cigarrillos",
  VAPERS: "Vapers",
  ELECTRONICA: "Electrónica",
  TECNOLOGIA: "Tecnología",
  OTROS: "Otros",
  VARIOS: "Varios",
};

export const RUBRO_RESERVADO = "VARIOS";

export function etiquetaRubro(clave: string) {
  if (SECCION_LABEL[clave]) return SECCION_LABEL[clave];
  const lower = clave.toLowerCase();
  return lower.replace(/\b\w/g, (letra) => letra.toUpperCase());
}

export function claveRubro(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export const MENSAJE_PEDIDO_GENERAL =
  "Hola La Triple L, quiero consultar por productos del minimarket";

export const MENSAJE_CATALOGO_PDF =
  "Hola La Triple L, ¿me pueden enviar el catálogo en PDF?";

export function mensajeConsultaProducto(nombreProducto: string) {
  return `Hola La Triple L, quiero consultar por ${nombreProducto}`;
}
