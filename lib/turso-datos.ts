import { createClient, type Client } from "@libsql/client";
import { desencriptarTexto, encriptarTexto } from "@/lib/cifrar-json";

const SENSIBLES = new Set(["usuarios.json", "pedidos.json", "cuentas.json"]);

let cliente: Client | null = null;
let tablaLista = false;

export function tursoActivo() {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim());
}

function clienteTurso() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Falta TURSO_DATABASE_URL.");
  }
  if (!cliente) {
    cliente = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
    });
  }
  return cliente;
}

async function asegurarTabla(c: Client) {
  if (tablaLista) return;
  await c.execute(`
    CREATE TABLE IF NOT EXISTS documentos (
      nombre TEXT PRIMARY KEY NOT NULL,
      cuerpo TEXT NOT NULL,
      actualizado TEXT NOT NULL
    )
  `);
  tablaLista = true;
}

export async function leerDatoTurso(nombre: string) {
  if (!tursoActivo()) return null;
  try {
    const c = clienteTurso();
    await asegurarTabla(c);
    const res = await c.execute({
      sql: "SELECT cuerpo FROM documentos WHERE nombre = ?",
      args: [nombre],
    });
    const raw = res.rows[0]?.cuerpo;
    if (typeof raw !== "string" || !raw) return null;
    return SENSIBLES.has(nombre) ? desencriptarTexto(raw) : raw;
  } catch (error) {
    console.error("[turso] lectura", nombre, error);
    return null;
  }
}

export async function guardarDatoTurso(nombre: string, json: string) {
  if (!tursoActivo()) return false;
  const cuerpo = SENSIBLES.has(nombre) ? encriptarTexto(json) : json;
  try {
    const c = clienteTurso();
    await asegurarTabla(c);
    await c.execute({
      sql: `
        INSERT INTO documentos (nombre, cuerpo, actualizado)
        VALUES (?, ?, ?)
        ON CONFLICT(nombre) DO UPDATE SET
          cuerpo = excluded.cuerpo,
          actualizado = excluded.actualizado
      `,
      args: [nombre, cuerpo, new Date().toISOString()],
    });
    return true;
  } catch (error) {
    console.error("[turso] escritura", nombre, error);
    return false;
  }
}

export async function listarDocumentosTurso() {
  if (!tursoActivo()) return [] as string[];
  const c = clienteTurso();
  await asegurarTabla(c);
  const res = await c.execute("SELECT nombre FROM documentos ORDER BY nombre");
  return res.rows
    .map((fila) => fila.nombre)
    .filter((n): n is string => typeof n === "string");
}
