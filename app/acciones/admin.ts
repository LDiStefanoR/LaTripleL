"use server";

import { borrarFotoSitioSiLibre, guardarFotoSitio } from "@/lib/fotos-sitio";
import { persistirFotosGithub } from "@/lib/persistir-github";
import { revalidatePath } from "next/cache";
import { guardarAjustes, leerAjustes } from "@/lib/ajustes";
import { claveRubro, RUBRO_RESERVADO } from "@/lib/categorias";
import { guardarProductos, leerProductos } from "@/lib/productos";
import { guardarRubros, leerRubros } from "@/lib/rubros";
import { getSesion } from "@/lib/sesion";

function numero(valor: FormDataEntryValue | null, fallback: number) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function revalidarSitio() {
  revalidatePath("/", "layout");
  revalidatePath("/catalogo");
  revalidatePath("/admin");
}

const MAX_FOTO = 5 * 1024 * 1024;
const TIPOS_FOTO: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

async function guardarFotoRubro(clave: string, archivo: File) {
  if (archivo.size > MAX_FOTO) {
    return { error: "La imagen no puede pesar más de 5 MB." as const };
  }
  const ext = TIPOS_FOTO[archivo.type];
  if (!ext) return { error: "Usá JPG, PNG o WebP." as const };
  const slug = clave.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "rubro";
  const nombre = `rubro-${slug}-${Date.now()}${ext}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());
  try {
    const ruta = await guardarFotoSitio({
      carpeta: "imagenes-rubros",
      nombre,
      buffer,
      mime: archivo.type,
    });
    return { ruta };
  } catch (error) {
    console.error("[foto-rubro]", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la foto del rubro.",
    };
  }
}

export type EstadoAdmin = { error?: string; ok?: string } | null;

async function exigirAdmin() {
  const sesion = await getSesion();
  return sesion?.rol === "admin" ? sesion : null;
}

function imagenesUsadasAdmin(
  productos: { imagen: string }[],
  rubros: { imagen?: string }[],
) {
  const usadas = productos.map((p) => p.imagen);
  for (const r of rubros) {
    if (r.imagen) usadas.push(r.imagen);
  }
  return usadas;
}

export async function guardarPreciosAdmin(
  _prev: EstadoAdmin,
  form: FormData,
): Promise<EstadoAdmin> {
  if (!(await exigirAdmin())) {
    return { error: "No tenés permiso para cambiar precios." };
  }

  const descuento = numero(form.get("descuentoClienteGenerico"), 10);
  if (descuento < 0 || descuento > 90) {
    return { error: "El descuento de clientes tiene que estar entre 0 y 90." };
  }

  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  const ajustes = await leerAjustes();
  const descuentoClientePorSeccion: Record<string, number> = {};
  for (const rubro of rubros) {
    const propioActivo = form.get(`dto-activo-${rubro.clave}`) === "1";
    if (!propioActivo) continue;
    const dto = numero(form.get(`dto-${rubro.clave}`), descuento);
    if (dto < 0 || dto > 90) {
      return {
        error: `El descuento de clientes de ${rubro.etiqueta} tiene que estar entre 0 y 90.`,
      };
    }
    descuentoClientePorSeccion[rubro.clave] = dto;
  }

  await guardarAjustes({
    descuentoClienteGenerico: descuento,
    ajustePorSeccion: ajustes.ajustePorSeccion,
    descuentoClientePorSeccion,
  });
  revalidarSitio();
  return { ok: "Guardamos el descuento de clientes." };
}

export async function crearRubro(form: FormData): Promise<EstadoAdmin> {
  if (!(await exigirAdmin())) {
    return { error: "No tenés permiso para crear rubros." };
  }
  const etiqueta = String(form.get("etiqueta") ?? "").trim();
  if (etiqueta.length < 3) {
    return { error: "Ingresá un nombre de rubro de al menos 3 letras." };
  }
  const clave = claveRubro(etiqueta);
  if (!clave) return { error: "El nombre del rubro no es válido." };

  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  if (rubros.some((r) => r.clave === clave)) {
    return { error: "Ese rubro ya existe." };
  }
  const sinVarios = rubros.filter((r) => r.clave !== RUBRO_RESERVADO);
  const varios = rubros.filter((r) => r.clave === RUBRO_RESERVADO);
  let imagen: string | undefined;
  const archivo = form.get("imagen");
  if (archivo instanceof File && archivo.size > 0) {
    const guardada = await guardarFotoRubro(clave, archivo);
    if ("error" in guardada) return { error: guardada.error };
    imagen = guardada.ruta;
  }
  await guardarRubros([
    ...sinVarios,
    { clave, etiqueta, ...(imagen ? { imagen } : {}) },
    ...varios,
  ]);
  revalidarSitio();
  const github = imagen ? await persistirFotosGithub() : "";
  return {
    ok: `Creamos el rubro "${etiqueta}". Ya aparece en el inicio y en el catálogo.${github}`,
  };
}

export async function renombrarRubro(form: FormData): Promise<EstadoAdmin> {
  if (!(await exigirAdmin())) {
    return { error: "No tenés permiso para renombrar rubros." };
  }
  const clave = String(form.get("clave") ?? "").trim();
  const etiqueta = String(form.get("etiqueta") ?? "").trim();
  if (!clave) return { error: "Falta el rubro." };
  if (etiqueta.length < 3) {
    return { error: "Ingresá un nombre de al menos 3 letras." };
  }

  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  const rubro = rubros.find((r) => r.clave === clave);
  if (!rubro) return { error: "No encontramos ese rubro." };

  const etiquetaNorm = etiqueta.toLowerCase();
  if (
    rubros.some(
      (r) => r.clave !== clave && r.etiqueta.toLowerCase() === etiquetaNorm,
    )
  ) {
    return { error: "Ya hay otro rubro con ese nombre." };
  }

  await guardarRubros(
    rubros.map((r) => (r.clave === clave ? { ...r, etiqueta } : r)),
  );
  revalidarSitio();
  return { ok: `El rubro ahora se llama "${etiqueta}". El catálogo ya lo muestra.` };
}

export async function eliminarRubro(form: FormData): Promise<EstadoAdmin> {
  if (!(await exigirAdmin())) {
    return { error: "No tenés permiso para eliminar rubros." };
  }
  const clave = String(form.get("clave") ?? "").trim();
  if (!clave) return { error: "Falta el rubro." };
  if (clave === RUBRO_RESERVADO) {
    return { error: "El rubro Varios no se puede eliminar." };
  }

  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  const rubro = rubros.find((r) => r.clave === clave);
  if (!rubro) return { error: "No encontramos ese rubro." };

  let movidos = 0;
  for (const producto of productos) {
    if (producto.seccion === clave) {
      producto.seccion = RUBRO_RESERVADO;
      movidos += 1;
    }
  }
  await guardarProductos(productos);

  const ajustes = await leerAjustes();
  const { [clave]: _quitado, ...restoAjuste } = ajustes.ajustePorSeccion;
  const { [clave]: _dto, ...restoDto } = ajustes.descuentoClientePorSeccion;
  await guardarAjustes({
    ...ajustes,
    ajustePorSeccion: restoAjuste,
    descuentoClientePorSeccion: restoDto,
  });
  const restantes = rubros.filter((r) => r.clave !== clave);
  await guardarRubros(restantes);
  await borrarFotoSitioSiLibre(
    rubro.imagen,
    imagenesUsadasAdmin(productos, restantes),
  );
  revalidarSitio();
  const github = await persistirFotosGithub();
  return {
    ok:
      movidos > 0
        ? `Eliminamos "${rubro.etiqueta}" y pasamos ${movidos} producto${movidos === 1 ? "" : "s"} a Varios. El catálogo ya está actualizado.${github}`
        : `Eliminamos "${rubro.etiqueta}". El catálogo ya no muestra ese rubro.${github}`,
  };
}

export async function subirImagenRubro(form: FormData): Promise<EstadoAdmin> {
  if (!(await exigirAdmin())) {
    return { error: "No tenés permiso para cambiar la foto del rubro." };
  }
  const clave = String(form.get("clave") ?? "").trim();
  const archivo = form.get("imagen");
  if (!clave) return { error: "Falta el rubro." };
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí una imagen de tu PC." };
  }

  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  if (!rubros.some((r) => r.clave === clave)) {
    return { error: "No encontramos ese rubro." };
  }

  const guardada = await guardarFotoRubro(clave, archivo);
  if ("error" in guardada) return { error: guardada.error };

  const anterior = rubros.find((r) => r.clave === clave)?.imagen;
  const actualizados = rubros.map((r) =>
    r.clave === clave ? { ...r, imagen: guardada.ruta } : r,
  );
  await guardarRubros(actualizados);
  await borrarFotoSitioSiLibre(
    anterior,
    imagenesUsadasAdmin(productos, actualizados),
  );
  revalidarSitio();
  const github = await persistirFotosGithub();
  return {
    ok: `Guardamos la foto. Ya se ve en el inicio y en el catálogo.${github}`,
  };
}

export async function guardarSeccionProducto(
  form: FormData,
): Promise<EstadoAdmin> {
  if (!(await exigirAdmin())) {
    return { error: "No tenés permiso para cambiar el rubro." };
  }
  const productoId = String(form.get("productoId") ?? "");
  const seccion = String(form.get("seccion") ?? "").trim();
  if (!productoId) return { error: "Falta el producto." };

  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  if (!rubros.some((r) => r.clave === seccion)) {
    return { error: "Ese rubro no existe." };
  }
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };
  producto.seccion = seccion;
  await guardarProductos(productos);
  revalidarSitio();
  const etiqueta = rubros.find((r) => r.clave === seccion)?.etiqueta ?? seccion;
  return { ok: `${producto.codigo} ahora está en ${etiqueta}.` };
}
