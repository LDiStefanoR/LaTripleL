import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.GOOGLE_DRIVE_ENABLED === "1") {
  spawnSync(process.execPath, [path.join(root, "scripts", "sync-drive.mjs"), "pull"], {
    stdio: "inherit",
    cwd: root,
  });
}

function copyDirFlat(src, dest, label) {
  if (!fs.existsSync(src)) {
    console.warn(`[sync-recursos] No existe: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    if (fs.statSync(from).isFile()) {
      fs.copyFileSync(from, path.join(dest, name));
    }
  }
  console.log(`[sync-recursos] OK → ${label}`);
}

const imgProdSrc = path.join(root, "recursos", "imagenes-productos");
const imgProdDest = path.join(root, "public", "recursos", "imagenes-productos");
copyDirFlat(imgProdSrc, imgProdDest, "public/recursos/imagenes-productos");

const imgRubroSrc = path.join(root, "recursos", "imagenes-rubros");
const imgRubroDest = path.join(root, "public", "recursos", "imagenes-rubros");
copyDirFlat(imgRubroSrc, imgRubroDest, "public/recursos/imagenes-rubros");

// Imágenes de sitio (hero reparto, banners, etc.)
const webSrc = path.join(root, "recursos", "web");
const webDest = path.join(root, "public", "recursos", "web");
copyDirFlat(webSrc, webDest, "public/recursos/web");

// Logo + favicon (Next.js usa app/icon.png automáticamente)
const logoNames = [
  "logo.jpg",
  "logo.jpeg",
  "LOGO.png",
  "logo.png",
  "Logo.png",
];
let logoSrc = null;
for (const n of logoNames) {
  const p = path.join(root, "recursos", n);
  if (fs.existsSync(p)) {
    logoSrc = p;
    break;
  }
}
if (logoSrc) {
  const pubRecursos = path.join(root, "public", "recursos");
  fs.mkdirSync(pubRecursos, { recursive: true });
  const ext = path.extname(logoSrc).toLowerCase();
  const destName = ext === ".png" ? "logo.png" : "logo.jpg";
  fs.copyFileSync(logoSrc, path.join(pubRecursos, destName));
  fs.copyFileSync(logoSrc, path.join(pubRecursos, "logo.jpg"));
  console.log("[sync-recursos] Logo → public/recursos/" + destName);
  await generarFavicons(logoSrc, root);
} else {
  console.warn("[sync-recursos] No se encontró logo en recursos/");
}

function icoDesdeRgba(rgba, lado) {
  const xorSize = lado * lado * 4;
  const andRow = Math.ceil(lado / 32) * 4;
  const andSize = andRow * lado;
  const dib = Buffer.alloc(40 + xorSize + andSize);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(lado, 4);
  dib.writeInt32LE(lado * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(xorSize + andSize, 20);

  let o = 40;
  for (let y = lado - 1; y >= 0; y--) {
    for (let x = 0; x < lado; x++) {
      const i = (y * lado + x) * 4;
      dib[o++] = rgba[i + 2];
      dib[o++] = rgba[i + 1];
      dib[o++] = rgba[i];
      dib[o++] = rgba[i + 3];
    }
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(lado, 0);
  entry.writeUInt8(lado, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(dib.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, dib]);
}

async function recorteCuadrado(origen) {
  const { width = 1, height = 1 } = await sharp(origen).metadata();
  const lado = Math.min(width, height);
  const left = Math.round((width - lado) / 2);
  const top = Math.round((height - lado) / 2);
  return sharp(origen).extract({ left, top, width: lado, height: lado });
}

async function generarFavicons(logoSrc, root) {
  const appDir = path.join(root, "app");
  const base = await recorteCuadrado(logoSrc);
  const png512 = await base
    .clone()
    .resize(512, 512, { fit: "cover" })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
  const png180 = await base
    .clone()
    .resize(180, 180, { fit: "cover" })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
  const { data: rgba32 } = await base
    .clone()
    .resize(32, 32, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(appDir, "icon.png"), png512);
  fs.writeFileSync(path.join(appDir, "apple-icon.png"), png180);
  fs.writeFileSync(path.join(appDir, "favicon.ico"), icoDesdeRgba(rgba32, 32));
  console.log("[sync-recursos] Favicon → app/favicon.ico, icon.png, apple-icon.png");
}
