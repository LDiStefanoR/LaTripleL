import type { LineaTicket } from "@/types/cuenta";

export function lineasATexto(lineas: LineaTicket[]) {
  return lineas
    .map((l) => (l.codigo ? `${l.codigo} - ${l.nombre}` : l.nombre))
    .join("\n");
}
