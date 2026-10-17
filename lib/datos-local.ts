import {
  ADDRESS_FULL,
  BRAND_NAME,
  HOURS_DETAIL,
  PHONE_DISPLAY,
} from "@/lib/brand";

/** Datos públicos del local. Los carga caja desde Mantenimiento. */
export type DatosLocal = {
  nombre: string;
  mail: string;
  telefono: string;
  direccion: string;
  horarios: string;
  alias: string;
  cbu: string;
  titular: string;
  banco: string;
  demoraEntrega: string;
  /** Logo del presupuesto. Vacío = logo por defecto del sitio. */
  logo: string;
};

export const DEMORA_ENTREGA_BASE = "entre 30 minutos y 1 hora";

function texto(valor: unknown, base = "") {
  const limpio = String(valor ?? "").trim();
  return limpio || base;
}

export function datosLocalDesde(
  raw?: (Partial<DatosLocal> & { logoLocal?: string }) | null,
): DatosLocal {
  return {
    nombre: texto(raw?.nombre, BRAND_NAME),
    mail: texto(raw?.mail),
    telefono: texto(raw?.telefono, PHONE_DISPLAY),
    direccion: texto(raw?.direccion, ADDRESS_FULL),
    horarios: texto(raw?.horarios, HOURS_DETAIL),
    alias: texto(raw?.alias),
    cbu: texto(raw?.cbu).replace(/\s/g, ""),
    titular: texto(raw?.titular, BRAND_NAME),
    banco: texto(raw?.banco),
    demoraEntrega: texto(raw?.demoraEntrega, DEMORA_ENTREGA_BASE),
    logo: texto(raw?.logo || raw?.logoLocal),
  };
}
