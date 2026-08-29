import { promises as fs } from "fs";
import path from "path";
import {
  blobActivo,
  guardarDatoBlob,
  leerDatoBlob,
} from "@/lib/blob-datos";

const memoria = new Map<string, string>();

function rutaTmp(nombre: string) {
  return path.join("/tmp", "latriplel-data", nombre);
}

function rutaRepo(nombre: string) {
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "data",
    nombre,
  );
}

function parsear<T>(raw: string, vacio: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return vacio;
  }
}

export async function leerJsonData<T>(nombre: string, vacio: T): Promise<T> {
  // En Vercel cada función tiene su propia memoria. Si leemos de acá,
  // el catálogo sigue mostrando el JSON del repo aunque otra instancia
  // ya haya guardado la foto nueva en Blob.
  if (!process.env.VERCEL) {
    const enMemoria = memoria.get(nombre);
    if (enMemoria) return parsear(enMemoria, vacio);
  }

  const remoto = await leerDatoBlob(nombre);
  if (remoto) {
    memoria.set(nombre, remoto);
    return parsear(remoto, vacio);
  }

  const locales = process.env.VERCEL
    ? [rutaTmp(nombre), rutaRepo(nombre)]
    : [rutaRepo(nombre)];

  for (const archivo of locales) {
    try {
      const raw = await fs.readFile(archivo, "utf8");
      memoria.set(nombre, raw);
      return parsear(raw, vacio);
    } catch {
      /* siguiente */
    }
  }

  return vacio;
}

async function escribirDisco(nombre: string, raw: string) {
  if (process.env.VERCEL) return;
  try {
    const archivo = rutaRepo(nombre);
    await fs.mkdir(path.dirname(archivo), { recursive: true });
    await fs.writeFile(archivo, raw, "utf8");
  } catch (error) {
    console.error(`[data] No se pudo guardar ${nombre} en disco`, error);
  }
}

export async function escribirJsonData(nombre: string, valor: unknown) {
  const raw = JSON.stringify(valor, null, 2);
  memoria.set(nombre, raw);

  if (process.env.VERCEL) {
    if (!blobActivo()) {
      throw new Error(
        "En internet los datos se guardan en Vercel Blob. Conectá Storage → Blob al proyecto y redesplegá.",
      );
    }
    const ok = await guardarDatoBlob(nombre, raw);
    if (!ok) {
      throw new Error(
        `No se pudo guardar ${nombre} en Vercel Blob. Revisá el token del store.`,
      );
    }
    return true;
  }

  await escribirDisco(nombre, raw);
  if (!blobActivo()) return true;
  const ok = await guardarDatoBlob(nombre, raw);
  if (!ok) {
    console.error(`[data] No se pudo guardar ${nombre} en Vercel Blob.`);
    return false;
  }
  return true;
}
