export function diasPlazoValido(valor: unknown): number | null {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n) || n < 1 || n > 365) return null;
  return n;
}

export function plazoCuentaDias(propio?: number | null, general?: number | null): number {
  return diasPlazoValido(propio) ?? diasPlazoValido(general) ?? 7;
}
