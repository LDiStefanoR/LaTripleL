"use server";

import { revalidatePath } from "next/cache";
import { leerAjustes } from "@/lib/ajustes";
import { leerMargen, leerEnteroOpcional } from "@/lib/margen";
import { leerProveedores } from "@/lib/deposito";
import { getSesion } from "@/lib/sesion";
import { guardarProductos, leerProductos } from "@/lib/productos";
import { borrarFotoSitioSiLibre, guardarFotoSitio } from "@/lib/fotos-sitio";
import { persistirFotosGithub } from "@/lib/persistir-github";
import { leerRubros } from "@/lib/rubros";
import { exigirPermisoCaja } from "@/lib/exigir-permiso";
import { puedeCobrar } from "@/lib/roles";

const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export type EstadoImagen = {
  error?: string;
  ok?: string;
  id?: string;
  codigos?: string[];
  producto?: {
    id: string;
    codigo: string;
    nombre: string;
    costo: number | null;
    margen: number | null;
    precio: number;
  };
} | null;

function revalidarCatalogo() {
  revalidatePath("/", "layout");
  revalidatePath("/catalogo");
  revalidatePath("/promos");
  revalidatePath("/admin");
  revalidatePath("/caja");
}

async function exigirAdmin() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return null;
  }
  return sesion;
}

async function exigirCaja() {
  return exigirPermisoCaja("productos");
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
  if (!(await exigirCaja())) {
    return { error: "Solo caja o administración pueden cambiar fotos." };
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
  if (!(await exigirCaja())) {
    return { error: "Solo caja o administración pueden eliminar productos." };
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

export async function guardarFichaProducto(
  form: FormData,
): Promise<EstadoImagen> {
  if (!(await exigirCaja())) {
    return { error: "Solo caja o administración pueden cambiar productos." };
  }

  const productoId = String(form.get("productoId") ?? "").trim();
  const nombre = String(form.get("nombre") ?? "").trim();
  const codigo = String(form.get("codigo") ?? "").trim();
  const seccion = String(form.get("seccion") ?? "").trim();
  const bruto = Number(String(form.get("precio") ?? "").replace(/[^\d]/g, ""));
  const stockRaw = String(form.get("stock") ?? "").trim();
  const costoRaw = String(form.get("costo") ?? "").trim();
  const margenRaw = String(form.get("margen") ?? "").trim();
  const minimoRaw = String(form.get("stockMinimo") ?? "").trim();
  const proveedorId = String(form.get("proveedorId") ?? "").trim();
  const mostrarEnCaja = String(form.get("mostrarEnCaja") ?? "") === "1";

  if (nombre.length < 3) {
    return { error: "Ingresá un nombre de al menos 3 caracteres." };
  }
  if (!codigo) return { error: "Ingresá un código." };
  if (!Number.isFinite(bruto) || bruto < 1) {
    return { error: "Ingresá un precio válido." };
  }

  let stock: number | undefined;
  if (stockRaw !== "") {
    const n = Number(stockRaw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      return { error: "El stock no puede ser negativo." };
    }
    stock = Math.round(n);
  }

  let costo: number | undefined;
  if (costoRaw !== "") {
    const n = Number(costoRaw.replace(/[^\d]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      return { error: "El costo no puede ser negativo." };
    }
    costo = Math.round(n);
  }
  const margen = leerMargen(margenRaw);
  if ("error" in margen) return { error: margen.error };
  const minimo = leerEnteroOpcional(minimoRaw, "El stock mínimo");
  if ("error" in minimo) return { error: minimo.error };
  if (proveedorId) {
    const proveedores = await leerProveedores();
    if (!proveedores.some((p) => p.id === proveedorId)) {
      return { error: "Elegí un proveedor cargado." };
    }
  }

  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  if (!rubros.some((r) => r.clave === seccion)) {
    return { error: "Elegí una sección válida." };
  }
  if (
    productos.some(
      (p) => p.id !== productoId && p.codigo.toLowerCase() === codigo.toLowerCase(),
    )
  ) {
    return { error: "Ya hay un producto con ese código." };
  }

  const ajustes = await leerAjustes();
  const extra = ajustes.ajustePorSeccion[seccion] ?? 0;
  const factor = 1 + extra / 100;
  const precio = factor === 0 ? Math.round(bruto) : Math.round(bruto / factor);

  if (!productoId) {
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
      mostrarEnCaja,
      ...(stock !== undefined ? { stock } : {}),
      ...(costo !== undefined ? { costo } : {}),
      ...(margen.margen !== undefined ? { margen: margen.margen } : {}),
      ...(minimo.valor !== undefined ? { stockMinimo: minimo.valor } : {}),
      ...(proveedorId ? { proveedorId } : {}),
    });
    await guardarProductos(productos);
    revalidarCatalogo();
    return { ok: `Creamos ${codigo}. Ya está en el catálogo y en la caja.`, id };
  }

  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };
  producto.codigo = codigo;
  producto.nombre = nombre;
  producto.seccion = seccion;
  producto.precio = precio;
  producto.mostrarEnCaja = mostrarEnCaja;
  if (stock === undefined) delete producto.stock;
  else producto.stock = stock;
  if (costo === undefined) delete producto.costo;
  else producto.costo = costo;
  if (margen.margen === undefined) delete producto.margen;
  else producto.margen = margen.margen;
  if (minimo.valor === undefined) delete producto.stockMinimo;
  else producto.stockMinimo = minimo.valor;
  if (proveedorId) producto.proveedorId = proveedorId;
  else delete producto.proveedorId;
  await guardarProductos(productos);
  revalidarCatalogo();
  return { ok: `Guardamos ${codigo} — ${nombre}.`, id: producto.id };
}

export async function guardarCodigosBarra(form: FormData): Promise<EstadoImagen> {
  if (!(await exigirCaja())) {
    return { error: "Solo caja o administración pueden cambiar productos." };
  }
  const productoId = String(form.get("productoId") ?? "").trim();
  let crudo: unknown = [];
  try {
    crudo = JSON.parse(String(form.get("codigos") ?? "[]"));
  } catch {
    return { error: "No pudimos leer los códigos." };
  }
  const lista = Array.isArray(crudo) ? crudo : [];
  const vistos = new Set<string>();
  const codigos: string[] = [];
  for (const item of lista) {
    const codigo = String(item ?? "").trim();
    if (!codigo) continue;
    if (codigo.length > 32) return { error: "Un código de barra es demasiado largo." };
    const clave = codigo.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    codigos.push(codigo);
  }

  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "Guardá el producto antes de cargar códigos de barra." };

  for (const codigo of codigos) {
    const otro = productos.find((p) => {
      if (p.id === producto.id) return false;
      if (p.codigo.toLowerCase() === codigo.toLowerCase()) return true;
      return (p.codigosBarra ?? []).some((c) => c.toLowerCase() === codigo.toLowerCase());
    });
    if (otro) {
      return { error: `${codigo} ya está en ${otro.codigo} — ${otro.nombre}.` };
    }
  }

  if (codigos.length === 0) delete producto.codigosBarra;
  else producto.codigosBarra = codigos;
  await guardarProductos(productos);
  revalidarCatalogo();
  return {
    ok: codigos.length === 0 ? "Sacamos los códigos de barra." : `Quedaron ${codigos.length} código${codigos.length === 1 ? "" : "s"} de barra.`,
    id: producto.id,
    codigos,
  };
}

export async function crearProductoRapido(form: FormData): Promise<EstadoImagen> {
  if (!(await exigirPermisoCaja("stock"))) {
    return { error: "No tenés permiso para cargar productos desde stock." };
  }
  const nombre = String(form.get("nombre") ?? "").trim();
  const codigo = String(form.get("codigo") ?? "").trim();
  const seccion = String(form.get("seccion") ?? "").trim();
  const bruto = Number(String(form.get("precio") ?? "").replace(/[^\d]/g, ""));
  const stockRaw = String(form.get("stock") ?? "").trim();
  const costoRaw = String(form.get("costo") ?? "").trim();
  const margenRaw = String(form.get("margen") ?? "").trim();
  const minimoRaw = String(form.get("stockMinimo") ?? "").trim();
  const proveedorId = String(form.get("proveedorId") ?? "").trim();
  const barra = String(form.get("barra") ?? "").trim();

  if (nombre.length < 3) return { error: "Ingresá un nombre de al menos 3 caracteres." };
  if (!codigo) return { error: "Ingresá un código." };
  if (!Number.isFinite(bruto) || bruto < 1) return { error: "Ingresá un precio válido." };

  let stock: number | undefined;
  if (stockRaw !== "") {
    const n = Number(stockRaw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return { error: "El stock no puede ser negativo." };
    stock = Math.round(n);
  }
  let costo: number | undefined;
  if (costoRaw !== "") {
    const n = Number(costoRaw.replace(/[^\d]/g, ""));
    if (!Number.isFinite(n) || n < 0) return { error: "El costo no puede ser negativo." };
    costo = Math.round(n);
  }
  const margen = leerMargen(margenRaw);
  if ("error" in margen) return { error: margen.error };
  const minimo = leerEnteroOpcional(minimoRaw, "El stock mínimo");
  if ("error" in minimo) return { error: minimo.error };

  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  if (!rubros.some((r) => r.clave === seccion)) return { error: "Elegí una sección válida." };
  if (productos.some((p) => p.codigo.toLowerCase() === codigo.toLowerCase())) {
    return { error: "Ya hay un producto con ese código." };
  }
  if (proveedorId) {
    const proveedores = await leerProveedores();
    if (!proveedores.some((p) => p.id === proveedorId)) return { error: "Elegí un proveedor cargado." };
  }

  const codigos: string[] = [];
  const vistos = new Set<string>();
  for (const item of barra.split(/[,;\n]/)) {
    const codigoBarra = item.trim();
    if (!codigoBarra) continue;
    if (codigoBarra.length > 32) return { error: "Un código de barra es demasiado largo." };
    const clave = codigoBarra.toLowerCase();
    if (vistos.has(clave) || clave === codigo.toLowerCase()) continue;
    vistos.add(clave);
    const otro = productos.find(
      (p) =>
        p.codigo.toLowerCase() === clave ||
        (p.codigosBarra ?? []).some((c) => c.toLowerCase() === clave),
    );
    if (otro) return { error: `${codigoBarra} ya está en ${otro.codigo} — ${otro.nombre}.` };
    codigos.push(codigoBarra);
  }

  const ajustes = await leerAjustes();
  const extra = ajustes.ajustePorSeccion[seccion] ?? 0;
  const factor = 1 + extra / 100;
  const precio = factor === 0 ? Math.round(bruto) : Math.round(bruto / factor);
  const delRubro = productos.find((p) => p.seccion === seccion);
  let imagen = delRubro?.imagen ?? "/recursos/imagenes-productos/bolsa-cierre.jpg";

  const archivo = form.get("imagen");
  if (archivo instanceof Blob && archivo.size > 0) {
    if (archivo.size > MAX_BYTES) return { error: "La imagen no puede pesar más de 5 MB." };
    const nombreFoto = "name" in archivo ? String((archivo as File).name || "").toLowerCase() : "";
    const mime = TIPOS[archivo.type]
      ? archivo.type
      : nombreFoto.endsWith(".png")
        ? "image/png"
        : nombreFoto.endsWith(".webp")
          ? "image/webp"
          : nombreFoto.endsWith(".jpg") || nombreFoto.endsWith(".jpeg")
            ? "image/jpeg"
            : "";
    const ext = TIPOS[mime];
    if (!ext) return { error: "Usá una foto JPG, PNG o WebP." };
    try {
      imagen = await guardarFotoSitio({
        carpeta: "imagenes-productos",
        nombre: nombreArchivo(codigo, ext),
        buffer: Buffer.from(await archivo.arrayBuffer()),
        mime,
      });
    } catch (error) {
      console.error("[producto-rapido]", error);
      return { error: "No se pudo guardar la foto." };
    }
  }

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
    descripcion: "Consultanos medidas, cantidades y disponibilidad por WhatsApp.",
    precioMayorista: Math.round(precio * 0.9),
    promoActiva: false,
    precioPromo: 0,
    precioSuper: 0,
    mostrarEnCaja: true,
    ...(stock !== undefined ? { stock } : {}),
    ...(costo !== undefined ? { costo } : {}),
    ...(margen.margen !== undefined ? { margen: margen.margen } : {}),
    ...(minimo.valor !== undefined ? { stockMinimo: minimo.valor } : {}),
    ...(proveedorId ? { proveedorId } : {}),
    ...(codigos.length > 0 ? { codigosBarra: codigos } : {}),
  });
  await guardarProductos(productos);
  revalidarCatalogo();
  return {
    ok: `Cargamos ${codigo} — ${nombre}.`,
    id,
    producto: {
      id,
      codigo,
      nombre,
      costo: costo ?? null,
      margen: margen.margen ?? null,
      precio: Math.round(bruto),
    },
  };
}
