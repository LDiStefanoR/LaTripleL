import { randomUUID } from "crypto";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { leerProductos } from "@/lib/productos";
import type { BasePromos, ComboPromo, Oferta, TipoOferta } from "@/types/promo";

const VACIO: BasePromos = { ofertas: [], combos: [], afiches: [], migrado: false };

async function leerBase(): Promise<BasePromos> {
  const parsed = await leerJsonData<BasePromos>("promociones.json", VACIO);
  return {
    ofertas: Array.isArray(parsed.ofertas) ? parsed.ofertas : [],
    combos: Array.isArray(parsed.combos) ? parsed.combos : [],
    afiches: Array.isArray(parsed.afiches) ? parsed.afiches : [],
    migrado: Boolean(parsed.migrado),
  };
}

async function guardarBase(data: BasePromos) {
  return escribirJsonData("promociones.json", data);
}

export async function leerPromos() {
  const data = await leerBase();
  if (data.migrado) return data;
  const productos = await leerProductos();
  for (const p of productos) {
    if (!p.promoActiva) continue;
    if (data.ofertas.some((o) => o.productoId === p.id && o.activa)) continue;
    data.ofertas.push({
      id: `of-${p.id}`,
      productoId: p.id,
      tipo: p.precioPromo && p.precioPromo > 0 ? "precio" : "precio",
      precioPromo: p.precioPromo && p.precioPromo > 0 ? p.precioPromo : undefined,
      carrusel: true,
      activa: true,
      creadoEn: new Date().toISOString(),
    });
  }
  data.migrado = true;
  await guardarBase(data);
  return data;
}

export async function ofertasActivas() {
  const data = await leerPromos();
  return data.ofertas.filter((o) => o.activa);
}

export async function combosActivos() {
  const data = await leerPromos();
  return data.combos.filter(
    (c) => c.activa && Array.isArray(c.productoIds) && c.productoIds.length >= 2,
  );
}

export function mapaOfertas(ofertas: Oferta[]) {
  const map = new Map<string, Oferta>();
  for (const o of ofertas) {
    if (o.activa) map.set(o.productoId, o);
  }
  return map;
}

export async function guardarOferta(datos: {
  productoId: string;
  tipo: TipoOferta;
  precioPromo?: number;
  carrusel: boolean;
}) {
  const productos = await leerProductos();
  if (!productos.some((p) => p.id === datos.productoId)) {
    return { error: "No encontramos ese producto." as const };
  }
  if (datos.tipo === "precio" && datos.precioPromo && datos.precioPromo < 1) {
    return { error: "El precio promo tiene que ser mayor a 0." as const };
  }
  const data = await leerPromos();
  data.ofertas = data.ofertas.filter((o) => o.productoId !== datos.productoId);
  const oferta: Oferta = {
    id: randomUUID(),
    productoId: datos.productoId,
    tipo: datos.tipo,
    precioPromo:
      datos.tipo === "precio" && datos.precioPromo && datos.precioPromo > 0
        ? Math.round(datos.precioPromo)
        : undefined,
    carrusel: datos.carrusel,
    activa: true,
    creadoEn: new Date().toISOString(),
  };
  data.ofertas.unshift(oferta);
  await guardarBase(data);
  return { ok: true as const, oferta };
}

export async function guardarCombo(datos: {
  productoIds: string[];
  precioCombo?: number;
}) {
  const ids = [...new Set(datos.productoIds.filter(Boolean))];
  if (ids.length !== 2 && ids.length !== 3) {
    return { error: "Elegí 2 o 3 productos para el combo." as const };
  }
  const productos = await leerProductos();
  for (const id of ids) {
    if (!productos.some((p) => p.id === id)) {
      return { error: "No encontramos uno de los productos." as const };
    }
  }
  if (datos.precioCombo && datos.precioCombo < 1) {
    return { error: "El precio del combo tiene que ser mayor a 0." as const };
  }
  const data = await leerPromos();
  const ocupados = new Set(
    data.combos.filter((c) => c.activa).flatMap((c) => c.productoIds),
  );
  if (ids.some((id) => ocupados.has(id))) {
    return {
      error: "Uno de esos productos ya está en otro combo." as const,
    };
  }
  const combo: ComboPromo = {
    id: randomUUID(),
    productoIds: ids,
    precioCombo:
      datos.precioCombo && datos.precioCombo > 0
        ? Math.round(datos.precioCombo)
        : undefined,
    activa: true,
    creadoEn: new Date().toISOString(),
  };
  data.combos.unshift(combo);
  await guardarBase(data);
  return { ok: true as const, combo };
}

export async function quitarCombo(id: string) {
  const data = await leerPromos();
  const antes = data.combos.length;
  data.combos = data.combos.filter((c) => c.id !== id);
  if (data.combos.length === antes) {
    return { error: "No encontramos ese combo." as const };
  }
  await guardarBase(data);
  return { ok: true as const };
}

export async function quitarOferta(id: string) {
  const data = await leerPromos();
  const antes = data.ofertas.length;
  data.ofertas = data.ofertas.filter((o) => o.id !== id);
  if (data.ofertas.length === antes) {
    return { error: "No encontramos esa promo." as const };
  }
  await guardarBase(data);
  return { ok: true as const };
}

export async function agregarAfiche(imagen: string) {
  const data = await leerPromos();
  const afiche = {
    id: randomUUID(),
    imagen,
    creadoEn: new Date().toISOString(),
  };
  data.afiches.unshift(afiche);
  await guardarBase(data);
  return { ok: true as const, afiche };
}

export async function quitarAfiche(id: string) {
  const data = await leerPromos();
  const afiche = data.afiches.find((a) => a.id === id);
  if (!afiche) return { error: "No encontramos ese afiche." as const };
  data.afiches = data.afiches.filter((a) => a.id !== id);
  await guardarBase(data);
  return { ok: true as const, imagen: afiche.imagen };
}
