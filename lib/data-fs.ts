import { promises as fs } from "fs";
import path from "path";
import {
  blobActivo,
  guardarDatoBlob,
  leerDatoBlob,
} from "@/lib/blob-datos";

const memoria = new Map<string, string>();

function directorioEscritura() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "latriplel-data");
  }
  return path.join(process.cwd(), "data");
}

function directoriosLectura() {
  const tmp = path.join("/tmp", "latriplel-data");
  const repo = path.join(process.cwd(), "data");
  return process.env.VERCEL ? [tmp, repo] : [repo];
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

  for (const dir of directoriosLectura()) {
    try {
      const raw = await fs.readFile(path.join(dir, nombre), "utf8");
      memoria.set(nombre, raw);
      return parsear(raw, vacio);
    } catch {
      /* siguiente */
    }
  }

  return vacio;
}

async function escribirDisco(nombre: string, raw: string) {
  if (process.env.VERCEL && blobActivo()) return;
  const dir = directorioEscritura();
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, nombre), raw, "utf8");
  } catch (error) {
    console.error(`[data] No se pudo guardar ${nombre} en disco`, error);
  }
}

export async function escribirJsonData(nombre: string, valor: unknown) {
  const raw = JSON.stringify(valor, null, 2);
  memoria.set(nombre, raw);
  await escribirDisco(nombre, raw);
  if (!blobActivo()) return true;
  const ok = await guardarDatoBlob(nombre, raw);
  if (!ok) {
    console.error(`[data] No se pudo guardar ${nombre} en Vercel Blob.`);
    return false;
  }
  return true;
}
