/**
 * Sube los JSON de data/ a Turso (tabla documentos).
 * Uso: node --env-file=.env.local scripts/subir-turso.mjs
 */
import { createClient } from "@libsql/client";
import { createCipheriv, createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const SENSIBLES = new Set(["usuarios.json", "pedidos.json", "cuentas.json"]);
const OMITIR = new Set([
  "ean-map.json",
  "off-cache.json",
  "off-name-cache.json",
  "super-cache.json",
]);

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
const secret = process.env.AUTH_SECRET?.trim();

if (!url) {
  console.error("Falta TURSO_DATABASE_URL en .env.local");
  process.exit(1);
}
if (!secret || secret.length < 16) {
  console.error("Falta AUTH_SECRET (mínimo 16 caracteres) para cifrar datos sensibles.");
  process.exit(1);
}

function encriptar(texto) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret).digest(),
    iv,
  );
  const enc = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return JSON.stringify({
    _mp: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    d: enc.toString("base64"),
  });
}

const client = createClient({ url, authToken: authToken || undefined });
const dataDir = path.join(process.cwd(), "data");

await client.execute(`
  CREATE TABLE IF NOT EXISTS documentos (
    nombre TEXT PRIMARY KEY NOT NULL,
    cuerpo TEXT NOT NULL,
    actualizado TEXT NOT NULL
  )
`);

const archivos = (await fs.readdir(dataDir))
  .filter((n) => n.endsWith(".json") && !OMITIR.has(n))
  .sort();

let ok = 0;
for (const nombre of archivos) {
  const raw = await fs.readFile(path.join(dataDir, nombre), "utf8");
  JSON.parse(raw); // validar
  const cuerpo = SENSIBLES.has(nombre) ? encriptar(raw) : raw;
  await client.execute({
    sql: `
      INSERT INTO documentos (nombre, cuerpo, actualizado)
      VALUES (?, ?, ?)
      ON CONFLICT(nombre) DO UPDATE SET
        cuerpo = excluded.cuerpo,
        actualizado = excluded.actualizado
    `,
    args: [nombre, cuerpo, new Date().toISOString()],
  });
  const kb = Math.round(Buffer.byteLength(cuerpo, "utf8") / 1024);
  console.log(`✓ ${nombre} (${kb} KB${SENSIBLES.has(nombre) ? ", cifrado" : ""})`);
  ok += 1;
}

const lista = await client.execute("SELECT nombre FROM documentos ORDER BY nombre");
console.log(`\nListo: ${ok} archivos. En Turso hay ${lista.rows.length} documentos.`);
