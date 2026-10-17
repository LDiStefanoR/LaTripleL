export function precioVenta(costo: number, margenPorcentaje: number) {
  return Math.round(costo * (1 + margenPorcentaje / 100));
}

export function sugerirPrecio(costoTexto: string, margenTexto: string) {
  if (!costoTexto.trim() || !margenTexto.trim()) return null;
  const costo = Number(costoTexto.replace(/[^\d]/g, ""));
  const margen = Number(margenTexto.replace(",", "."));
  if (!Number.isFinite(costo) || costo < 0) return null;
  if (!Number.isFinite(margen) || margen < 0) return null;
  return precioVenta(costo, margen);
}

export function leerMargen(raw: string): { error: string } | { margen: number | undefined } {
  const texto = raw.trim();
  if (!texto) return { margen: undefined };
  const n = Number(texto.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 500) {
    return { error: "El margen tiene que estar entre 0 y 500%." };
  }
  return { margen: Math.round(n * 10) / 10 };
}

export function leerEnteroOpcional(
  raw: string,
  etiqueta: string,
): { error: string } | { valor: number | undefined } {
  const texto = raw.trim();
  if (!texto) return { valor: undefined };
  const n = Number(texto.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return { error: `${etiqueta} no puede ser negativo.` };
  return { valor: Math.round(n) };
}
