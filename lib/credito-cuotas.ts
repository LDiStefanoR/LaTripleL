export const PLAZOS_CREDITO = [1, 2, 3, 6] as const;
export type PlazoCredito = (typeof PLAZOS_CREDITO)[number];

export const TASA_CUOTA_BASE: Record<PlazoCredito, number> = {
  1: 15,
  2: 25,
  3: 35,
  6: 50,
};

export function plazoCredito(valor: unknown): PlazoCredito {
  const n = Number(valor);
  if (n === 1 || n === 2 || n === 3 || n === 6) return n;
  return 6;
}

export function tasasCredito(cliente?: {
  interes1?: number;
  interes2?: number;
  interes3?: number;
  interes6?: number;
  interesModo?: "general" | "propio";
  cuotasMaximas?: number;
  cuotasHabilitadas?: number[];
  bases?: Partial<Record<PlazoCredito, number>>;
}) {
  function tasa(guardada: number | undefined, base: number) {
    if (typeof guardada !== "number" || !Number.isFinite(guardada)) return base;
    return Math.min(500, Math.max(0, Math.round(guardada * 10) / 10));
  }
  const bases = { ...TASA_CUOTA_BASE, ...cliente?.bases };
  const propio =
    cliente?.interesModo === "propio" ||
    (cliente?.interesModo !== "general" &&
      [cliente?.interes1, cliente?.interes2, cliente?.interes3, cliente?.interes6].some(
        (valor) => typeof valor === "number",
      ));
  const todas: Record<PlazoCredito, number> = {
    1: propio ? tasa(cliente?.interes1, bases[1]) : bases[1],
    2: propio ? tasa(cliente?.interes2, bases[2]) : bases[2],
    3: propio ? tasa(cliente?.interes3, bases[3]) : bases[3],
    6: propio ? tasa(cliente?.interes6, bases[6]) : bases[6],
  };
  const marcadas = (cliente?.cuotasHabilitadas ?? []).filter(
    (plazo): plazo is PlazoCredito => plazo === 1 || plazo === 2 || plazo === 3 || plazo === 6,
  );
  const max = plazoCredito(cliente?.cuotasMaximas ?? 6);
  const plazos = marcadas.length
    ? PLAZOS_CREDITO.filter((plazo) => marcadas.includes(plazo))
    : PLAZOS_CREDITO.filter((plazo) => plazo <= max);
  return {
    max: plazos.at(-1) ?? max,
    plazos,
    tasas: todas,
  };
}

export function simularCredito(monto: number, cuotas: PlazoCredito, tasa: number) {
  const capital = Math.max(0, Math.round(monto) || 0);
  const interes = Math.round(capital * (tasa / 100));
  const total = capital + interes;
  const cuota = cuotas > 0 ? Math.ceil(total / cuotas) : total;
  return { capital, interes, total, cuota, cuotas, tasa };
}
