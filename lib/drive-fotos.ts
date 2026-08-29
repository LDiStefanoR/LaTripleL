import { createWriteStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { google, type drive_v3 } from "googleapis";

export const DRIVE_CARPETAS = [
  "imagenes-productos",
  "imagenes-rubros",
  "web",
] as const;

export type CarpetaFotos = (typeof DRIVE_CARPETAS)[number];

const FOLDER_RAIZ =
  process.env.GOOGLE_DRIVE_FOLDER_ID ??
  "1-dV0LvGUyqJCp3FvBTlk_FReUD0m23g3";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

let cacheSubcarpetas: Record<string, string> | null = null;

function credenciales() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function keyFile() {
  return (
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    ""
  );
}

export function driveFotosActivo() {
  if (process.env.GOOGLE_DRIVE_ENABLED !== "1") return false;
  return Boolean(credenciales() || keyFile());
}

function cliente(): drive_v3.Drive | null {
  if (!driveFotosActivo()) return null;
  const creds = credenciales();
  const archivo = keyFile();
  const auth = creds
    ? new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ["https://www.googleapis.com/auth/drive"],
      })
    : new google.auth.GoogleAuth({
        keyFile: archivo,
        scopes: ["https://www.googleapis.com/auth/drive"],
      });
  return google.drive({ version: "v3", auth });
}

function escapeQuery(nombre: string) {
  return nombre.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function asegurarSubcarpeta(
  drive: drive_v3.Drive,
  nombre: CarpetaFotos,
) {
  if (!cacheSubcarpetas) cacheSubcarpetas = {};
  if (cacheSubcarpetas[nombre]) return cacheSubcarpetas[nombre];

  const q = `'${FOLDER_RAIZ}' in parents and name='${escapeQuery(nombre)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const { data } = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const id = data.files?.[0]?.id;
  if (id) {
    cacheSubcarpetas[nombre] = id;
    return id;
  }
  const creado = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: [FOLDER_RAIZ],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!creado.data.id) {
    throw new Error(`No se pudo crear la carpeta ${nombre} en Drive.`);
  }
  cacheSubcarpetas[nombre] = creado.data.id;
  return creado.data.id;
}

async function buscarArchivo(
  drive: drive_v3.Drive,
  carpetaId: string,
  nombre: string,
) {
  const q = `'${carpetaId}' in parents and name='${escapeQuery(nombre)}' and trashed=false`;
  const { data } = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return data.files?.[0]?.id ?? null;
}

export async function subirFotoDrive(opts: {
  carpeta: CarpetaFotos;
  nombre: string;
  buffer: Buffer;
  mime?: string;
}) {
  const drive = cliente();
  if (!drive) return { omitido: true as const };
  const ext = path.extname(opts.nombre).toLowerCase();
  const mime = opts.mime ?? MIME[ext] ?? "application/octet-stream";
  const carpetaId = await asegurarSubcarpeta(drive, opts.carpeta);
  const existente = await buscarArchivo(drive, carpetaId, opts.nombre);
  const media = { mimeType: mime, body: Readable.from(opts.buffer) };
  if (existente) {
    await drive.files.update({
      fileId: existente,
      media,
      supportsAllDrives: true,
    });
    return { id: existente };
  }
  const creado = await drive.files.create({
    requestBody: { name: opts.nombre, parents: [carpetaId] },
    media,
    fields: "id",
    supportsAllDrives: true,
  });
  return { id: creado.data.id ?? "" };
}

export async function borrarFotoDrive(carpeta: CarpetaFotos, nombre: string) {
  const drive = cliente();
  if (!drive) return;
  const carpetaId = await asegurarSubcarpeta(drive, carpeta);
  const id = await buscarArchivo(drive, carpetaId, nombre);
  if (!id) return;
  await drive.files.delete({ fileId: id, supportsAllDrives: true });
}

export async function bajarFotosDrive(destinoRecursos: string) {
  const drive = cliente();
  if (!drive) return 0;
  let total = 0;
  for (const carpeta of DRIVE_CARPETAS) {
    const carpetaId = await asegurarSubcarpeta(drive, carpeta);
    let pageToken: string | undefined;
    const dir = path.join(destinoRecursos, carpeta);
    await fs.mkdir(dir, { recursive: true });
    do {
      const { data } = await drive.files.list({
        q: `'${carpetaId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
        fields: "nextPageToken, files(id,name)",
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const file of data.files ?? []) {
        if (!file.id || !file.name) continue;
        const dest = path.join(dir, file.name);
        const res = await drive.files.get(
          { fileId: file.id, alt: "media", supportsAllDrives: true },
          { responseType: "stream" },
        );
        await new Promise<void>((resolve, reject) => {
          const ws = createWriteStream(dest);
          (res.data as NodeJS.ReadableStream)
            .on("error", reject)
            .pipe(ws)
            .on("finish", () => resolve())
            .on("error", reject);
        });
        total += 1;
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
  }
  return total;
}

export async function publicarFotosLocalesEnDrive(origenRecursos: string) {
  const drive = cliente();
  if (!drive) return 0;
  let total = 0;
  for (const carpeta of DRIVE_CARPETAS) {
    const dir = path.join(origenRecursos, carpeta);
    let nombres: string[] = [];
    try {
      nombres = (await fs.readdir(dir)).filter((n) => !n.startsWith("."));
    } catch {
      continue;
    }
    for (const nombre of nombres) {
      const archivo = path.join(dir, nombre);
      const st = await fs.stat(archivo);
      if (!st.isFile()) continue;
      const buffer = await fs.readFile(archivo);
      await subirFotoDrive({ carpeta, nombre, buffer });
      total += 1;
    }
  }
  const logo = path.join(origenRecursos, "logo.jpg");
  try {
    const buffer = await fs.readFile(logo);
    await subirFotoDrive({
      carpeta: "web",
      nombre: "logo.jpg",
      buffer,
      mime: "image/jpeg",
    });
    total += 1;
  } catch {
    /* sin logo */
  }
  return total;
}

export async function subirArchivoDriveDesdeDisco(
  carpeta: CarpetaFotos,
  archivo: string,
) {
  const buffer = await fs.readFile(archivo);
  await subirFotoDrive({
    carpeta,
    nombre: path.basename(archivo),
    buffer,
  });
}
