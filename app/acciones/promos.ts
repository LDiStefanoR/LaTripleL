"use server";

import { revalidatePath } from "next/cache";
import { getSesion } from "@/lib/sesion";
import { guardarFotoSitio, borrarFotoSitioSiLibre } from "@/lib/fotos-sitio";
import {
  agregarAfiche,
  guardarCombo,
  guardarOferta,
  leerPromos,
  quitarAfiche,
  quitarCombo,
  quitarOferta,
} from "@/lib/promos";
import { guardarProductos, leerProductos } from "@/lib/productos";
import type { TipoOferta } from "@/types/promo";

export type EstadoPromo = { error?: string; ok?: string } | null;

const MAX_AFICHE = 8 * 1024 * 1024;
const TIPOS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function revalidar() {
  revalidatePath("/", "layout");
  revalidatePath("/catalogo");
  revalidatePath("/promos");
  revalidatePath("/admin");
  revalidatePath("/admin/promos");
}

async function exigirAdmin() {
  const sesion = await getSesion();
  return sesion?.rol === "admin" ? sesion : null;
}

async function sincronizarProducto(productoId: string, oferta: {
  tipo: TipoOferta;
  precioPromo?: number;
} | null) {
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return;
  if (!oferta) {
    producto.promoActiva = false;
    producto.precioPromo = 0;
  } else {
    producto.promoActiva = true;
    producto.precioPromo = oferta.tipo === "precio" ? oferta.precioPromo ?? 0 : 0;
  }
  await guardarProductos(productos);
}

export async function adminGuardarOferta(form: FormData): Promise<EstadoPromo> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const productoId = String(form.get("productoId") ?? "").trim();
  const tipo = String(form.get("tipo") ?? "") as TipoOferta;
  if (tipo !== "2x1" && tipo !== "3x2" && tipo !== "precio") {
    return { error: "Elegí 2x1, 3x2 o destacar en carrusel." };
  }
  const precioPromo = Number(String(form.get("precioPromo") ?? "").replace(/[^\d]/g, "")) || 0;
  const carrusel = String(form.get("carrusel") ?? "1") !== "0";
  const resultado = await guardarOferta({
    productoId,
    tipo,
    precioPromo,
    carrusel,
  });
  if ("error" in resultado) return { error: resultado.error };
  await sincronizarProducto(productoId, {
    tipo,
    precioPromo: resultado.oferta.precioPromo,
  });
  revalidar();
  const nombre =
    tipo === "2x1" ? "2x1" : tipo === "3x2" ? "3x2" : "destacada en carrusel";
  return { ok: `Promo ${nombre} activa.` };
}

export async function adminQuitarOferta(form: FormData): Promise<EstadoPromo> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = String(form.get("id") ?? "");
  const data = await leerPromos();
  const oferta = data.ofertas.find((o) => o.id === id);
  const resultado = await quitarOferta(id);
  if ("error" in resultado) return { error: resultado.error };
  if (oferta) await sincronizarProducto(oferta.productoId, null);
  revalidar();
  return { ok: "Sacamos esa promo." };
}

export async function adminGuardarCombo(form: FormData): Promise<EstadoPromo> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const productoIds = form
    .getAll("productoId")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const precioCombo =
    Number(String(form.get("precioCombo") ?? "").replace(/[^\d]/g, "")) || 0;
  const resultado = await guardarCombo({ productoIds, precioCombo });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok: `Combo de ${resultado.combo.productoIds.length} productos activo.`,
  };
}

export async function adminQuitarCombo(form: FormData): Promise<EstadoPromo> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = String(form.get("id") ?? "");
  const resultado = await quitarCombo(id);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Sacamos ese combo." };
}

export async function adminSubirAfiche(form: FormData): Promise<EstadoPromo> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const archivo = form.get("imagen");
  if (!(archivo instanceof Blob) || archivo.size === 0) {
    return { error: "Elegí la imagen A4 de Gemini." };
  }
  if (archivo.size > MAX_AFICHE) {
    return { error: "La imagen no puede pesar más de 8 MB." };
  }
  const mime =
    archivo.type ||
    ("name" in archivo && String((archivo as File).name || "").toLowerCase().endsWith(".png")
      ? "image/png"
      : "image/jpeg");
  const ext = TIPOS[mime] ?? TIPOS[archivo.type];
  if (!ext) return { error: "Usá JPG, PNG o WebP." };
  const buffer = Buffer.from(await archivo.arrayBuffer());
  let ruta: string;
  try {
    ruta = await guardarFotoSitio({
      carpeta: "web",
      nombre: `promo-a4-${Date.now()}${ext}`,
      buffer,
      mime,
    });
  } catch (error) {
    console.error("[afiche]", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el afiche.",
    };
  }
  await agregarAfiche(ruta);
  revalidar();
  return { ok: "Cargamos el afiche. Ya se ve en Promos." };
}

export async function adminQuitarAfiche(form: FormData): Promise<EstadoPromo> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = String(form.get("id") ?? "");
  const resultado = await quitarAfiche(id);
  if ("error" in resultado) return { error: resultado.error };
  const data = await leerPromos();
  const usadas = data.afiches.map((a) => a.imagen);
  await borrarFotoSitioSiLibre(resultado.imagen, usadas);
  revalidar();
  return { ok: "Sacamos el afiche." };
}
