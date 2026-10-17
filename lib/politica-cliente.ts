import { PLAZOS_CREDITO, type PlazoCredito } from "@/lib/credito-cuotas";
import type { PoliticaMora } from "@/lib/deuda";
import { textoEscalaMora } from "@/lib/deuda";

export type ModoMora = "escala" | "fijo" | "sin";
export type ModoInteres = "general" | "propio";

export type FichaInteres = {
  cuotasHabilitadas?: number[] | null;
  cuotasMaximas?: number | null;
  interesModo?: ModoInteres | null;
  interes1?: number | null;
  interes2?: number | null;
  interes3?: number | null;
  interes6?: number | null;
  moraModo?: ModoMora | null;
  moraPorcentaje?: number | null;
  moraCreditoModo?: ModoMora | null;
  moraCreditoPorcentaje?: number | null;
  moraCuentaModo?: ModoMora | null;
  moraCuentaPorcentaje?: number | null;
};

export function esPlazoCredito(valor: unknown): valor is PlazoCredito {
  const n = Number(valor);
  return n === 1 || n === 2 || n === 3 || n === 6;
}

export function cuotasHabilitadasDe(ficha?: FichaInteres | null): PlazoCredito[] {
  const marcadas = (ficha?.cuotasHabilitadas ?? []).filter(esPlazoCredito);
  if (marcadas.length > 0) return PLAZOS_CREDITO.filter((plazo) => marcadas.includes(plazo));
  const max = Number(ficha?.cuotasMaximas);
  const tope = esPlazoCredito(max) ? max : 6;
  return PLAZOS_CREDITO.filter((plazo) => plazo <= tope);
}

export function interesModoDe(ficha?: FichaInteres | null): ModoInteres {
  if (ficha?.interesModo === "propio" || ficha?.interesModo === "general") return ficha.interesModo;
  const propio = [ficha?.interes1, ficha?.interes2, ficha?.interes3, ficha?.interes6].some(
    (valor) => typeof valor === "number",
  );
  return propio ? "propio" : "general";
}

export function modoMoraDe(valor: unknown, base?: ModoMora | null): ModoMora {
  if (valor === "fijo" || valor === "sin" || valor === "escala") return valor;
  if (base === "fijo" || base === "sin" || base === "escala") return base;
  return "escala";
}

export function moraCreditoDe(ficha?: FichaInteres | null): { modo: ModoMora; porcentaje: number } {
  return {
    modo: modoMoraDe(ficha?.moraCreditoModo, ficha?.moraModo),
    porcentaje: Math.round(ficha?.moraCreditoPorcentaje ?? ficha?.moraPorcentaje ?? 0),
  };
}

export function moraCuentaDe(ficha?: FichaInteres | null): { modo: ModoMora; porcentaje: number } {
  return {
    modo: modoMoraDe(ficha?.moraCuentaModo, ficha?.moraModo),
    porcentaje: Math.round(ficha?.moraCuentaPorcentaje ?? ficha?.moraPorcentaje ?? 0),
  };
}

export function politicaDeCliente(
  ficha: FichaInteres | null | undefined,
  escalas?: { moraCredito?: readonly number[]; moraCuenta?: readonly number[] },
): PoliticaMora {
  const credito = moraCreditoDe(ficha);
  const cuenta = moraCuentaDe(ficha);
  return {
    moraModo: cuenta.modo,
    moraPorcentaje: cuenta.porcentaje,
    moraCreditoModo: credito.modo,
    moraCreditoPorcentaje: credito.porcentaje,
    moraCuentaModo: cuenta.modo,
    moraCuentaPorcentaje: cuenta.porcentaje,
    moraCredito: escalas?.moraCredito,
    moraCuenta: escalas?.moraCuenta,
  };
}

export function textoMoraSemanal(modo: ModoMora, porcentaje: number, titulo: string, escala?: readonly number[]) {
  if (modo === "sin") return `${titulo}: no suma interés si se vence.`;
  if (modo === "fijo") return `${titulo}: ${Math.min(100, Math.max(0, porcentaje))}% por cada semana de atraso.`;
  return textoEscalaMora(titulo, escala);
}

export function textoCuotas(cuotas: PlazoCredito[]) {
  if (cuotas.length === PLAZOS_CREDITO.length) return "1, 2, 3 y 6 cuotas";
  if (cuotas.length === 0) return "Sin cuotas habilitadas";
  return cuotas.map((plazo) => (plazo === 1 ? "1 cuota" : `${plazo} cuotas`)).join(", ");
}
