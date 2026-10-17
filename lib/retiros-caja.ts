import { randomUUID } from "crypto";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { hoyArgentina } from "@/lib/caja";

export type RetiroCaja = {
  id: string;
  creadoEn: string;
  empleado: string;
  empleadoEmail: string;
  concepto: string;
  monto: number;
};

export async function leerRetirosCaja(): Promise<RetiroCaja[]> {
  const parsed = await leerJsonData<RetiroCaja[]>("retiros-caja.json", []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function retirosDelDia(dia = hoyArgentina()) {
  const retiros = await leerRetirosCaja();
  return retiros
    .filter((r) => hoyArgentina(new Date(r.creadoEn)) === dia)
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export async function registrarRetiro(datos: {
  empleado: string;
  empleadoEmail: string;
  concepto: string;
  monto: number;
}) {
  const concepto = datos.concepto.trim();
  const monto = Math.round(datos.monto);
  if (concepto.length < 2) return { error: "Escribí el concepto del retiro." as const };
  if (!Number.isFinite(monto) || monto < 1) return { error: "El monto del retiro tiene que ser mayor a 0." as const };
  const retiros = await leerRetirosCaja();
  const retiro: RetiroCaja = {
    id: randomUUID(),
    creadoEn: new Date().toISOString(),
    empleado: datos.empleado,
    empleadoEmail: datos.empleadoEmail,
    concepto,
    monto,
  };
  retiros.push(retiro);
  await escribirJsonData("retiros-caja.json", retiros);
  return { retiro };
}
