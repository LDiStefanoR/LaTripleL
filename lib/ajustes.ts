import { TASA_CUOTA_BASE } from "@/lib/credito-cuotas";
import { ENVIO_BASE, escalaEnvio } from "@/lib/envio";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { MORA_BASE } from "@/lib/deuda";
import { diasPlazoValido } from "@/lib/plazo-cuenta";
import type { AjustesPrecios, EscalaMora, TasasCuota } from "@/types/ajustes";

export const AJUSTES_PRECIOS_BASE: AjustesPrecios = {
  descuentoClienteGenerico: 10,
  recargoWeb: 0,
  ajustePorSeccion: {},
  descuentoClientePorSeccion: {},
  tasasCuota: { ...TASA_CUOTA_BASE },
  moraCredito: [...MORA_BASE],
  moraCuenta: [...MORA_BASE],
  plazoCuenta: 7,
  envio: { ...ENVIO_BASE },
};

const vacio = AJUSTES_PRECIOS_BASE;

function porcentaje(valor: unknown, max = 90) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

function porcentajeFirmado(valor: unknown, max = 90) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= -max && n <= max ? n : null;
}

function tasaCuota(valor: unknown, base: number) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || n > 500) return base;
  return Math.round(n * 10) / 10;
}

function escala(valor: unknown): EscalaMora {
  const lista = Array.isArray(valor) ? valor : [];
  return [0, 1, 2, 3].map((i) => tasaCuota(lista[i], MORA_BASE[i])) as EscalaMora;
}

function tasas(valor: unknown): TasasCuota {
  const raw = valor && typeof valor === "object" ? (valor as Partial<TasasCuota>) : {};
  return {
    1: tasaCuota(raw[1], TASA_CUOTA_BASE[1]),
    2: tasaCuota(raw[2], TASA_CUOTA_BASE[2]),
    3: tasaCuota(raw[3], TASA_CUOTA_BASE[3]),
    6: tasaCuota(raw[6], TASA_CUOTA_BASE[6]),
  };
}

function mapaPorcentajes(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [clave, valor] of Object.entries(raw as Record<string, unknown>)) {
    const n = porcentaje(valor);
    if (clave && n !== null) out[clave] = n;
  }
  return out;
}

export async function leerAjustes(): Promise<AjustesPrecios> {
  const parsed = await leerJsonData<Partial<AjustesPrecios>>("ajustes.json", vacio);
  const descuento = porcentajeFirmado(parsed.descuentoClienteGenerico) ?? 10;
  const recargo = porcentaje(parsed.recargoWeb, 200) ?? 0;
  return {
    descuentoClienteGenerico: descuento,
    recargoWeb: recargo,
    ajustePorSeccion:
      parsed.ajustePorSeccion && typeof parsed.ajustePorSeccion === "object"
        ? parsed.ajustePorSeccion
        : {},
    descuentoClientePorSeccion: mapaPorcentajes(
      parsed.descuentoClientePorSeccion,
    ),
    tasasCuota: tasas(parsed.tasasCuota),
    moraCredito: escala(parsed.moraCredito),
    moraCuenta: escala(parsed.moraCuenta),
    plazoCuenta: diasPlazoValido(parsed.plazoCuenta) ?? 7,
    envio: escalaEnvio(parsed.envio),
  };
}

export async function guardarAjustes(ajustes: AjustesPrecios) {
  await escribirJsonData("ajustes.json", ajustes);
}
