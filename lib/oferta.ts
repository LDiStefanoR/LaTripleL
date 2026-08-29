import type { TipoOferta } from "@/types/promo";

export const ETIQUETA_OFERTA: Record<TipoOferta, string> = {
  "2x1": "2x1",
  "3x2": "3x2",
  precio: "Precio promo",
};

export function unidadesAPagar(cantidad: number, tipo?: TipoOferta | null) {
  if (cantidad < 1) return 0;
  if (tipo === "2x1") return Math.floor(cantidad / 2) + (cantidad % 2);
  if (tipo === "3x2") {
    const grupos = Math.floor(cantidad / 3);
    return grupos * 2 + (cantidad % 3);
  }
  return cantidad;
}

export function promoCantidadLista(cantidad: number, tipo?: TipoOferta | null) {
  if (tipo === "2x1") return cantidad >= 2;
  if (tipo === "3x2") return cantidad >= 3;
  return tipo === "precio";
}

export function avisoCantidadPromo(tipo?: TipoOferta | null) {
  if (tipo === "2x1") return "Llevá 2 y pagás 1";
  if (tipo === "3x2") return "Llevá 3 y pagás 2";
  return "";
}

export function totalLineaConPromo(
  cantidad: number,
  precio: number,
  tipo?: TipoOferta | null,
) {
  return unidadesAPagar(cantidad, tipo) * precio;
}
