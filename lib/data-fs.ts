import { promises as fs } from "fs";
import path from "path";
import {
  blobActivo,
  guardarDatoBlob,
  leerDatoBlob,
} from "@/lib/blob-datos";
import {
  guardarDatoTurso,
  leerDatoTurso,
  tursoActivo,
} from "@/lib/turso-datos";

const memoriaGlobal = globalThis as typeof globalThis & {
  __latriplelMemoria?: Map<string, string>;
};
if (!memoriaGlobal.__latriplelMemoria) {
  memoriaGlobal.__latriplelMemoria = new Map();
}
const memoria = memoriaGlobal.__latriplelMemoria;

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

function remotoActivo() {
  return tursoActivo() || blobActivo();
}

export async function leerJsonData<T>(nombre: string, vacio: T): Promise<T> {
  // En Vercel cada función tiene su propia memoria. Si leemos de acá,
  // el catálogo sigue mostrando el JSON del repo aunque otra instancia
  // ya haya guardado la foto nueva en Blob/Turso.
  if (!process.env.VERCEL) {
    const enMemoria = memoria.get(nombre);
    if (enMemoria) return parsear(enMemoria, vacio);
  }

  if (tursoActivo()) {
    const remoto = await leerDatoTurso(nombre);
    if (remoto) {
      memoria.set(nombre, remoto);
      return parsear(remoto, vacio);
    }
  }

  const blob = await leerDatoBlob(nombre);
  if (blob) {
    memoria.set(nombre, blob);
    return parsear(blob, vacio);
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
    if (tursoActivo()) {
      const ok = await guardarDatoTurso(nombre, raw);
      if (!ok) {
        throw new Error(
          `No se pudo guardar ${nombre} en Turso. Revisá TURSO_DATABASE_URL y TURSO_AUTH_TOKEN.`,
        );
      }
      return true;
    }
    if (!blobActivo()) {
      throw new Error(
        "En internet los datos se guardan en Turso (o Vercel Blob). Cargá TURSO_DATABASE_URL y redesplegá.",
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

  if (tursoActivo()) {
    const ok = await guardarDatoTurso(nombre, raw);
    if (!ok) {
      console.error(`[data] No se pudo guardar ${nombre} en Turso.`);
      return false;
    }
  }

  if (!blobActivo()) return true;
  const ok = await guardarDatoBlob(nombre, raw);
  if (!ok) {
    console.error(`[data] No se pudo guardar ${nombre} en Vercel Blob.`);
    return false;
  }
  return true;
}

export function almacenamientoRemotoActivo() {
  return remotoActivo();
}
