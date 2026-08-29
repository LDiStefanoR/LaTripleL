const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatoFecha(valor: string) {
  const d = valor.slice(0, 10);
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return valor;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatoPesos(valor: number) {
  return ars.format(valor);
}

export function nombreVitrina(nombre: string) {
  const lower = nombre.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Extrae el contenido neto del nombre, p. ej. "500 ml" o "1 L". */
export function unidadProducto(nombre: string) {
  const m = nombre.match(
    /(?:x\s*)?([\d.,]+\s*(?:ml|lts?|l|cc|grs?|g|kgs?|unid(?:ades)?|u\.?d?s?))\b/i,
  );
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim();
}

