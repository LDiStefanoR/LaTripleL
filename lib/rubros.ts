import {
  etiquetaRubro,
  RUBRO_RESERVADO,
  SECCION_LABEL,
  SECCIONES,
} from "@/lib/categorias";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import type { Rubro } from "@/types/rubro";

function semilla(): Rubro[] {
  return SECCIONES.map((clave) => ({
    clave,
    etiqueta: SECCION_LABEL[clave] ?? clave,
  }));
}

function asegurarVarios(lista: Rubro[]) {
  const sinVarios = lista.filter((r) => r.clave !== RUBRO_RESERVADO);
  const varios = lista.find((r) => r.clave === RUBRO_RESERVADO);
  return [
    ...sinVarios,
    {
      clave: RUBRO_RESERVADO,
      etiqueta: varios?.etiqueta || "Varios",
      ...(varios?.imagen ? { imagen: varios.imagen } : {}),
    },
  ];
}

export async function leerRubros(clavesUsadas: string[] = []): Promise<Rubro[]> {
  let lista: Rubro[] = [];
  const parsed = await leerJsonData<Rubro[]>("rubros.json", []);
  if (Array.isArray(parsed) && parsed.length > 0) {
    lista = parsed.filter((r) => r?.clave);
  }
  if (lista.length === 0) {
    lista = semilla();
    try {
      await guardarRubros(lista);
    } catch (error) {
      console.error("[rubros] No se pudo guardar la semilla", error);
    }
  }
  const map = new Map(lista.map((r) => [r.clave, r]));
  for (const clave of clavesUsadas) {
    if (clave && !map.has(clave)) {
      map.set(clave, { clave, etiqueta: etiquetaRubro(clave) });
    }
  }
  return asegurarVarios([...map.values()]);
}

export async function guardarRubros(rubros: Rubro[]) {
  const limpios = asegurarVarios(
    rubros
      .filter((r) => r.clave && r.etiqueta)
      .map((r) => ({
        clave: r.clave,
        etiqueta: r.etiqueta,
        ...(r.imagen ? { imagen: r.imagen } : {}),
      })),
  );
  await escribirJsonData("rubros.json", limpios);
}
