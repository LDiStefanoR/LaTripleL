import { del, get, put } from "@vercel/blob";
import { desencriptarTexto, encriptarTexto } from "@/lib/cifrar-json";

const SENSIBLES = new Set(["usuarios.json", "pedidos.json", "cuentas.json"]);
type Acceso = "public" | "private";

let accesoUsado: Acceso | null = null;

function idTienda() {
  return (
    process.env.marveBlob2_STORE_ID ||
    process.env.marvegota_STORE_ID ||
    process.env.BLOB_STORE_ID ||
    ""
  ).trim();
}

function tokenTienda() {
  return (
    process.env.marveBlob2_READ_WRITE_TOKEN ||
    process.env.marvegota_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    ""
  ).trim();
}

function prepararEnvBlob() {
  const id = idTienda();
  const token = tokenTienda();
  if (id && !process.env.BLOB_STORE_ID) {
    process.env.BLOB_STORE_ID = id;
  }
  if (token && !process.env.BLOB_READ_WRITE_TOKEN) {
    process.env.BLOB_READ_WRITE_TOKEN = token;
  }
}

function authBlob() {
  prepararEnvBlob();
  const storeId = idTienda();
  const token = tokenTienda();
  return {
    ...(storeId ? { storeId } : {}),
    ...(token ? { token } : {}),
  };
}

function accesoPreferido(): Acceso {
  if (accesoUsado) return accesoUsado;
  const env = process.env.BLOB_ACCESS?.trim().toLowerCase();
  if (env === "public") return "public";
  return "private";
}

function ordenAcceso(): Acceso[] {
  const primero = accesoPreferido();
  return primero === "public" ? ["public", "private"] : ["private", "public"];
}

function esChoqueAcceso(error: unknown, access: Acceso) {
  const msg = error instanceof Error ? error.message : String(error);
  if (access === "private" && /public store/i.test(msg)) return true;
  if (access === "public" && /private (store|access)/i.test(msg)) return true;
  return false;
}

export function blobActivo() {
  prepararEnvBlob();
  return Boolean(tokenTienda() || idTienda());
}

export function rutaDato(nombre: string) {
  return `datos/${nombre}`;
}

export function rutaFoto(carpeta: string, nombre: string) {
  return `fotos/${carpeta}/${nombre}`;
}

export function urlFotoPublica(carpeta: string, nombre: string) {
  return `/api/media/${rutaFoto(carpeta, nombre)}`;
}

function mensajeBlob(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "No se pudo hablar con Vercel Blob.";
}

async function streamATexto(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return null;
  const buf = Buffer.from(await new Response(stream).arrayBuffer());
  return buf.toString("utf8");
}

async function putBlob(
  pathname: string,
  body: Parameters<typeof put>[1],
  extra: Omit<Parameters<typeof put>[2], "access" | "token" | "storeId">,
) {
  let ultimo: unknown;
  for (const access of ordenAcceso()) {
    try {
      const blob = await put(pathname, body, {
        access,
        ...authBlob(),
        ...extra,
      });
      accesoUsado = access;
      return blob;
    } catch (error) {
      ultimo = error;
      if (esChoqueAcceso(error, access)) continue;
      throw error;
    }
  }
  throw ultimo;
}

async function getBlob(pathname: string, useCache: boolean) {
  let ultimo: unknown;
  for (const access of ordenAcceso()) {
    try {
      const result = await get(pathname, {
        access,
        ...authBlob(),
        useCache,
      });
      accesoUsado = access;
      return result;
    } catch (error) {
      ultimo = error;
      if (esChoqueAcceso(error, access)) continue;
      throw error;
    }
  }
  throw ultimo;
}

export async function leerDatoBlob(nombre: string) {
  if (!blobActivo()) return null;
  try {
    const result = await getBlob(rutaDato(nombre), false);
    if (!result?.stream) return null;
    const raw = await streamATexto(result.stream);
    if (!raw) return null;
    return SENSIBLES.has(nombre) ? desencriptarTexto(raw) : raw;
  } catch (error) {
    console.error("[blob] lectura", nombre, error);
    return null;
  }
}

export async function guardarDatoBlob(nombre: string, json: string) {
  if (!blobActivo()) return false;
  const cuerpo = SENSIBLES.has(nombre) ? encriptarTexto(json) : json;
  try {
    await putBlob(rutaDato(nombre), cuerpo, {
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    return true;
  } catch (error) {
    console.error("[blob] escritura", nombre, error);
    return false;
  }
}

export async function subirFotoBlob(
  carpeta: string,
  nombre: string,
  buffer: Buffer,
  mime: string,
) {
  prepararEnvBlob();
  if (!idTienda() && !tokenTienda()) {
    throw new Error(
      "Vercel no ve la tienda Blob. Conectá el store privado al proyecto (marveBlob2_STORE_ID) y redesplegá.",
    );
  }
  try {
    const blob = await putBlob(rutaFoto(carpeta, nombre), buffer, {
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: mime || "application/octet-stream",
      cacheControlMaxAge: 0,
    });
    if (accesoUsado === "private") {
      return urlFotoPublica(carpeta, nombre);
    }
    return blob.url || urlFotoPublica(carpeta, nombre);
  } catch (error) {
    console.error("[blob] foto", error);
    throw new Error(mensajeBlob(error));
  }
}

export async function borrarFotoBlob(url: string) {
  if (!blobActivo()) return;
  const pathname = url.startsWith("/api/media/")
    ? decodeURIComponent(url.slice("/api/media/".length))
    : url;
  await del(pathname, authBlob()).catch((error) => {
    console.error("[blob] borrar foto", error);
  });
}

export function esUrlBlob(url: string) {
  return /vercel-storage\.com/i.test(url) || url.startsWith("/api/media/");
}

export async function leerBlobBinario(pathname: string) {
  if (!blobActivo()) return null;
  const result = await getBlob(pathname, false);
  if (!result?.stream) return null;
  const body = Buffer.from(await new Response(result.stream).arrayBuffer());
  const type = result.blob.contentType || "application/octet-stream";
  return { body, type };
}
