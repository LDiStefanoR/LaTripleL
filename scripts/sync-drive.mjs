import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { Readable } from "stream";
import { createWriteStream } from "fs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARPETAS = ["imagenes-productos", "imagenes-rubros", "web"];
const FOLDER_RAIZ =
  process.env.GOOGLE_DRIVE_FOLDER_ID || "1-dV0LvGUyqJCp3FvBTlk_FReUD0m23g3";

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const archivo = path.join(root, name);
    if (!fs.existsSync(archivo)) continue;
    for (const raw of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

function auth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const keyFile =
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (json) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(json),
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
  }
  if (keyFile) {
    return new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
  }
  return null;
}

function escapeQuery(nombre) {
  return nombre.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function subcarpeta(drive, nombre) {
  const q = `'${FOLDER_RAIZ}' in parents and name='${escapeQuery(nombre)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const { data } = await drive.files.list({
    q,
    fields: "files(id)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (data.files?.[0]?.id) return data.files[0].id;
  const creado = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: [FOLDER_RAIZ],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return creado.data.id;
}

async function buscar(drive, carpetaId, nombre) {
  const q = `'${carpetaId}' in parents and name='${escapeQuery(nombre)}' and trashed=false`;
  const { data } = await drive.files.list({
    q,
    fields: "files(id)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return data.files?.[0]?.id ?? null;
}

async function pull(drive) {
  let total = 0;
  for (const carpeta of CARPETAS) {
    const id = await subcarpeta(drive, carpeta);
    const dir = path.join(root, "recursos", carpeta);
    fs.mkdirSync(dir, { recursive: true });
    let pageToken;
    do {
      const { data } = await drive.files.list({
        q: `'${id}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
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
        await new Promise((resolve, reject) => {
          const ws = createWriteStream(dest);
          res.data.on("error", reject).pipe(ws).on("finish", resolve).on("error", reject);
        });
        total += 1;
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  console.log(`[sync-drive] Bajamos ${total} fotos desde Drive`);
}

async function push(drive) {
  let total = 0;
  for (const carpeta of CARPETAS) {
    const dir = path.join(root, "recursos", carpeta);
    if (!fs.existsSync(dir)) continue;
    const id = await subcarpeta(drive, carpeta);
    for (const nombre of fs.readdirSync(dir)) {
      const archivo = path.join(dir, nombre);
      if (!fs.statSync(archivo).isFile() || nombre.startsWith(".")) continue;
      const buffer = fs.readFileSync(archivo);
      const existente = await buscar(drive, id, nombre);
      const media = { body: Readable.from(buffer) };
      if (existente) {
        await drive.files.update({
          fileId: existente,
          media,
          supportsAllDrives: true,
        });
      } else {
        await drive.files.create({
          requestBody: { name: nombre, parents: [id] },
          media,
          fields: "id",
          supportsAllDrives: true,
        });
      }
      total += 1;
    }
  }
  const logo = path.join(root, "recursos", "logo.jpg");
  if (fs.existsSync(logo)) {
    const id = await subcarpeta(drive, "web");
    const buffer = fs.readFileSync(logo);
    const existente = await buscar(drive, id, "logo.jpg");
    const media = { mimeType: "image/jpeg", body: Readable.from(buffer) };
    if (existente) {
      await drive.files.update({
        fileId: existente,
        media,
        supportsAllDrives: true,
      });
    } else {
      await drive.files.create({
        requestBody: { name: "logo.jpg", parents: [id] },
        media,
        fields: "id",
        supportsAllDrives: true,
      });
    }
    total += 1;
  }
  console.log(`[sync-drive] Subimos ${total} fotos a Drive`);
}

loadEnv();
if (process.env.GOOGLE_DRIVE_ENABLED !== "1") {
  console.log("[sync-drive] Drive en pausa: las fotos se versionan en GitHub.");
  process.exit(0);
}
const modo = process.argv[2] || "pull";
const googleAuth = auth();
if (!googleAuth) {
  console.log(
    "[sync-drive] Sin cuenta de Google: las fotos quedan solo en este servidor.",
  );
  process.exit(0);
}

const drive = google.drive({ version: "v3", auth: googleAuth });
const run = modo === "push" ? push(drive) : pull(drive);
run.catch((err) => {
  console.error("[sync-drive]", err.message || err);
  process.exit(1);
});
