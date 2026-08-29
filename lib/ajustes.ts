import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import type { AjustesPrecios } from "@/types/ajustes";

const vacio: AjustesPrecios = {
  descuentoClienteGenerico: 10,
  ajustePorSeccion: {},
  descuentoClientePorSeccion: {},
};

function porcentaje(valor: unknown, max = 90) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
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
  const descuento = porcentaje(parsed.descuentoClienteGenerico) ?? 10;
  return {
    descuentoClienteGenerico: descuento,
    ajustePorSeccion:
      parsed.ajustePorSeccion && typeof parsed.ajustePorSeccion === "object"
        ? parsed.ajustePorSeccion
        : {},
    descuentoClientePorSeccion: mapaPorcentajes(
      parsed.descuentoClientePorSeccion,
    ),
  };
}

export async function guardarAjustes(ajustes: AjustesPrecios) {
  await escribirJsonData("ajustes.json", ajustes);
}
