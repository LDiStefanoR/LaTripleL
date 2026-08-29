"use server";

import { revalidatePath } from "next/cache";
import { leerAjustes } from "@/lib/ajustes";
import { getSesion } from "@/lib/sesion";
import { guardarProductos, leerProductos } from "@/lib/productos";
import { borrarFotoSitioSiLibre, guardarFotoSitio } from "@/lib/fotos-sitio";
import { persistirFotosGithub } from "@/lib/persistir-github";
import { leerRubros } from "@/lib/rubros";

const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export type EstadoImagen = { error?: string; ok?: string } | null;

function revalidarCatalogo() {
  revalidatePath("/", "layout");
  revalidatePath("/catalogo");
  revalidatePath("/promos");
  revalidatePath("/admin");
}

async function exigirAdmin() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return null;
  }
  return sesion;
}

function nombreArchivo(codigo: string, ext: string) {
  const limpio = codigo.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "prod";
  return `carga-${limpio}-${Date.now()}${ext}`;
}

function imagenesUsadas(
  productos: { imagen: string }[],
  rubros: { imagen?: string }[],
) {
  const usadas = productos.map((p) => p.imagen);
  for (const r of rubros) {
    if (r.imagen) usadas.push(r.imagen);
  }
  return usadas;
}

export async function subirImagenProducto(
  form: FormData,
): Promise<EstadoImagen> {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return { error: "Solo el administrador puede cambiar fotos." };
  }

  const productoId = String(form.get("productoId") ?? "");
  const aplicarMisma = String(form.get("aplicarMismaFoto") ?? "") === "1";
  const archivo = form.get("imagen");

  if (!productoId) return { error: "Falta el producto." };
  if (!(archivo instanceof Blob) || archivo.size === 0) {
    return { error: "Elegí una imagen de tu PC." };
  }
  if (archivo.size > MAX_BYTES) {
    return { error: "La imagen no puede pesar más de 5 MB." };
  }
  const mime =
    archivo.type ||
    ("name" in archivo &&
    String((archivo as File).name || "")
      .toLowerCase()
      .endsWith(".png")
      ? "image/png"
      : "name" in archivo &&
          String((archivo as File).name || "")
            .toLowerCase()
            .endsWith(".webp")
        ? "image/webp"
        : "image/jpeg");
  const ext = TIPOS[mime] ?? TIPOS[archivo.type];
  if (!ext) return { error: "Usá JPG, PNG o WebP." };

  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };

  const nombre = nombreArchivo(producto.codigo, ext);
  const buffer = Buffer.from(await archivo.arrayBuffer());
  let ruta: string;
  try {
    ruta = await guardarFotoSitio({
      carpeta: "imagenes-productos",
      nombre,
      buffer,
      mime,
    });
  } catch (error) {
    console.error("[imagen]", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la foto. Probá de nuevo o usá una imagen más liviana.",
    };
  }
  const anterior = producto.imagen;
  let afectados = 0;
  for (const item of productos) {
    if (item.id === productoId || (aplicarMisma && item.imagen === anterior)) {
      item.imagen = ruta;
      afectados += 1;
    }
  }
  try {
    const ok = await guardarProductos(productos);
    if (!ok) {
      return {
        error:
          "La foto se subió, pero no se pudo actualizar el catálogo. Probá de nuevo.",
      };
    }
    const rubros = await leerRubros(productos.map((p) => p.seccion));
    await borrarFotoSitioSiLibre(anterior, imagenesUsadas(productos, rubros));
    await persistirFotosGithub().catch((error) => {
      console.error("[imagen] github", error);
    });
    revalidatePath("/", "layout");
    revalidatePath("/catalogo");
    revalidatePath("/admin");
  } catch (error) {
    console.error("[imagen] guardar", error);
    return {
      error:
        "La foto se subió, pero no se pudo actualizar el catálogo. Probá de nuevo.",
    };
  }

  if (afectados > 1) {
    return {
      ok: `Guardamos la foto y la aplicamos a ${afectados} productos que usaban la misma imagen.`,
    };
  }
  return {
    ok: "Listo, actualizamos la foto de este producto.",
  };
}

export async function guardarPrecioProducto(
  form: FormData,
): Promise<EstadoImagen> {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return { error: "Solo el administrador puede cambiar precios." };
  }

  const productoId = String(form.get("productoId") ?? "");
  const bruto = Number(String(form.get("precio") ?? "").replace(/[^\d]/g, ""));
  if (!productoId) return { error: "Falta el producto." };
  if (!Number.isFinite(bruto) || bruto < 1) {
    return { error: "Ingresá un precio general válido." };
  }

  const ajustes = await leerAjustes();
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };

  const extra = ajustes.ajustePorSeccion[producto.seccion] ?? 0;
  const factor = 1 + extra / 100;
  producto.precio = factor === 0 ? Math.round(bruto) : Math.round(bruto / factor);
  await guardarProductos(productos);

  revalidatePath("/", "layout");
  revalidatePath("/catalogo");
  revalidatePath("/admin");

  return {
    ok: `Guardamos el precio general de ${producto.codigo}: $${Math.round(bruto).toLocaleString("es-AR")}.`,
  };
}

export async function guardarPromoProducto(
  form: FormData,
): Promise<EstadoImagen> {
  if (!(await exigirAdmin())) {
    return { error: "Solo el administrador puede cargar promociones." };
  }
  const productoId = String(form.get("productoId") ?? "");
  if (!productoId) return { error: "Falta el producto." };
  const activa = String(form.get("promoActiva") ?? "") === "1";
  const promoBruto = String(form.get("precioPromo") ?? "").replace(/[^\d]/g, "");
  const superBruto = String(form.get("precioSuper") ?? "").replace(/[^\d]/g, "");
  const precioPromo = promoBruto ? Number(promoBruto) : 0;
  const precioSuper = superBruto ? Number(superBruto) : 0;
  if (activa && (!Number.isFinite(precioPromo) || precioPromo < 1)) {
    return { error: "Para activar la promo cargá el precio promocional." };
  }

  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };
  producto.promoActiva = activa;
  producto.precioPromo = activa ? Math.round(precioPromo) : 0;
  producto.precioSuper = Number.isFinite(precioSuper) && precioSuper > 0
    ? Math.round(precioSuper)
    : 0;
  await guardarProductos(productos);
  revalidarCatalogo();
  return {
    ok: activa
      ? `Promo activa en ${producto.codigo}: $${producto.precioPromo.toLocaleString("es-AR")}.`
      : `Sacamos la promo de ${producto.codigo}.`,
  };
}

export async function guardarNombreProducto(
  form: FormData,
): Promise<EstadoImagen> {
  if (!(await exigirAdmin())) {
    return { error: "Solo el administrador puede cambiar productos." };
  }
  const productoId = String(form.get("productoId") ?? "");
  const nombre = String(form.get("nombre") ?? "").trim();
  if (!productoId) return { error: "Falta el producto." };
  if (nombre.length < 3) {
    return { error: "El nombre tiene que tener al menos 3 caracteres." };
  }
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };
  producto.nombre = nombre;
  await guardarProductos(productos);
  revalidarCatalogo();
  return { ok: `Actualizamos el nombre de ${producto.codigo}.` };
}

export async function eliminarProducto(
  form: FormData,
): Promise<EstadoImagen> {
  if (!(await exigirAdmin())) {
    return { error: "Solo el administrador puede eliminar productos." };
  }
  const productoId = String(form.get("productoId") ?? "");
  if (!productoId) return { error: "Falta el producto." };
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };
  const resto = productos.filter((p) => p.id !== productoId);
  await guardarProductos(resto);
  const rubros = await leerRubros(resto.map((p) => p.seccion));
  await borrarFotoSitioSiLibre(producto.imagen, imagenesUsadas(resto, rubros));
  revalidarCatalogo();
  const github = await persistirFotosGithub();
  return { ok: `Eliminamos ${producto.codigo} — ${producto.nombre}.${github}` };
}

export async function crearProducto(form: FormData): Promise<EstadoImagen> {
  if (!(await exigirAdmin())) {
    return { error: "Solo el administrador puede crear productos." };
  }
  const nombre = String(form.get("nombre") ?? "").trim();
  const codigo = String(form.get("codigo") ?? "").trim();
  const seccion = String(form.get("seccion") ?? "").trim();
  const bruto = Number(String(form.get("precio") ?? "").replace(/[^\d]/g, ""));

  if (nombre.length < 3) {
    return { error: "Ingresá un nombre de al menos 3 caracteres." };
  }
  if (!codigo) return { error: "Ingresá un código." };
  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  if (!rubros.some((r) => r.clave === seccion)) {
    return { error: "Elegí un rubro válido." };
  }
  if (!Number.isFinite(bruto) || bruto < 1) {
    return { error: "Ingresá un precio general válido." };
  }

  if (
    productos.some((p) => p.codigo.toLowerCase() === codigo.toLowerCase())
  ) {
    return { error: "Ya hay un producto con ese código." };
  }

  const ajustes = await leerAjustes();
  const extra = ajustes.ajustePorSeccion[seccion] ?? 0;
  const factor = 1 + extra / 100;
  const precio =
    factor === 0 ? Math.round(bruto) : Math.round(bruto / factor);

  const delRubro = productos.find((p) => p.seccion === seccion);
  const imagen =
    delRubro?.imagen ?? "/recursos/imagenes-productos/bolsa-cierre.jpg";

  const idBase = `mp-${codigo.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || Date.now()}`;
  let id = idBase;
  let n = 2;
  while (productos.some((p) => p.id === id)) {
    id = `${idBase}-${n}`;
    n += 1;
  }

  productos.unshift({
    id,
    codigo,
    nombre,
    seccion,
    precio,
    imagen,
    descripcion:
      "Consultanos medidas, cantidades y disponibilidad por WhatsApp.",
    precioMayorista: Math.round(precio * 0.9),
    promoActiva: false,
    precioPromo: 0,
    precioSuper: 0,
  });
  await guardarProductos(productos);
  revalidarCatalogo();
  return { ok: `Creamos ${codigo}. Ya está en el catálogo.` };
}
