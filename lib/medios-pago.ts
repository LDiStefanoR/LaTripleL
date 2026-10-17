import { randomUUID } from "crypto";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";

export type MedioPago = {
  id: string;
  nombre: string;
  /** Si es efectivo, al cobrar se escribe con cuánto paga el cliente y se calcula el vuelto. */
  efectivo: boolean;
};

const SEMILLA: MedioPago[] = [
  { id: "contado", nombre: "Contado", efectivo: true },
  { id: "tarjeta", nombre: "Tarjeta", efectivo: false },
  { id: "moto", nombre: "Moto", efectivo: false },
];

export async function leerMediosPago(): Promise<MedioPago[]> {
  const lista = await leerJsonData<MedioPago[]>("medios-pago.json", SEMILLA);
  const limpia = (Array.isArray(lista) ? lista : []).filter(
    (m) => m && typeof m.nombre === "string" && m.nombre.trim().length > 0,
  );
  if (limpia.length === 0) return SEMILLA.map((m) => ({ ...m }));
  if (!limpia.some((m) => m.efectivo)) limpia[0] = { ...limpia[0], efectivo: true };
  return limpia;
}

export async function guardarMedioPago(datos: { nombre: string; efectivo: boolean }) {
  const nombre = datos.nombre.trim();
  if (nombre.length < 2) return { error: "Ingresá el nombre del medio de pago." as const };
  const lista = await leerMediosPago();
  if (lista.some((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) {
    return { error: "Ya hay un medio de pago con ese nombre." as const };
  }
  const medio: MedioPago = { id: randomUUID(), nombre, efectivo: datos.efectivo };
  const siguiente = datos.efectivo ? lista.map((m) => ({ ...m, efectivo: false })) : [...lista];
  siguiente.push(medio);
  if (!siguiente.some((m) => m.efectivo)) medio.efectivo = true;
  await escribirJsonData("medios-pago.json", siguiente);
  return { ok: true as const, nombre };
}

export async function quitarMedioPago(id: string) {
  const lista = await leerMediosPago();
  const medio = lista.find((m) => m.id === id);
  if (!medio) return { error: "No encontramos ese medio de pago." as const };
  if (lista.length === 1) return { error: "Tiene que quedar al menos un medio de pago." as const };
  const siguiente = lista.filter((m) => m.id !== id);
  if (!siguiente.some((m) => m.efectivo)) siguiente[0] = { ...siguiente[0], efectivo: true };
  await escribirJsonData("medios-pago.json", siguiente);
  return { ok: true as const, nombre: medio.nombre };
}
