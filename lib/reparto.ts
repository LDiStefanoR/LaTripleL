import type { FranjaReparto, ModoEntrega } from "@/types/pedido";

const TZ = "America/Argentina/Buenos_Aires";

const DIA_LARGO = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

export type TurnoReparto = {
  iso: string;
  franja: FranjaReparto;
};

export type DiaProgramable = {
  iso: string;
  label: string;
  franjas: FranjaReparto[];
};

type AhoraAR = {
  iso: string;
  weekday: number;
  minutos: number;
};

function partesAR(date = new Date()): AhoraAR {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(
    fmt.formatToParts(date).map((x) => [x.type, x.value]),
  );
  const weekday: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    iso: `${p.year}-${p.month}-${p.day}`,
    weekday: weekday[p.weekday] ?? 1,
    minutos: Number(p.hour) * 60 + Number(p.minute),
  };
}

function sumarDiasIso(iso: string, dias: number) {
  const d = new Date(`${iso}T15:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return partesAR(d).iso;
}

function weekdayDeIso(iso: string) {
  return partesAR(new Date(`${iso}T15:00:00.000Z`)).weekday;
}

/** Domingo solo mañana (abren 10–14). El resto, mañana y tarde. */
export function franjasDelDia(iso: string, ahora = partesAR()) {
  const weekday = weekdayDeIso(iso);
  const slots: FranjaReparto[] = weekday === 0 ? ["manana"] : ["manana", "tarde"];
  if (iso !== ahora.iso) return slots;
  return slots.filter((franja) => {
    if (franja === "manana") return ahora.minutos < 12 * 60;
    return ahora.minutos < 19 * 60;
  });
}

function fechaCorta(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

export function etiquetaDia(iso: string, hoy = partesAR().iso) {
  const weekday = weekdayDeIso(iso);
  const fecha = fechaCorta(iso);
  if (iso === hoy) return `Hoy ${DIA_LARGO[weekday]} ${fecha}`;
  if (iso === sumarDiasIso(hoy, 1)) return `Mañana ${DIA_LARGO[weekday]} ${fecha}`;
  return `${DIA_LARGO[weekday]} ${fecha}`;
}

export function proximoTurno(date = new Date()): TurnoReparto {
  const ahora = partesAR(date);
  for (let i = 0; i < 16; i++) {
    const iso = sumarDiasIso(ahora.iso, i);
    const franjas = franjasDelDia(iso, ahora);
    if (franjas[0]) return { iso, franja: franjas[0] };
  }
  return { iso: ahora.iso, franja: "manana" };
}

export function diasParaProgramar(cantidad = 10, date = new Date()): DiaProgramable[] {
  const ahora = partesAR(date);
  const dias: DiaProgramable[] = [];
  for (let i = 0; i < 21 && dias.length < cantidad; i++) {
    const iso = sumarDiasIso(ahora.iso, i);
    const franjas = franjasDelDia(iso, ahora);
    if (!franjas.length) continue;
    dias.push({
      iso,
      label: etiquetaDia(iso, ahora.iso),
      franjas,
    });
  }
  return dias;
}

export function turnoValido(iso: string, franja: FranjaReparto, date = new Date()) {
  const dia = diasParaProgramar(14, date).find((d) => d.iso === iso);
  return Boolean(dia?.franjas.includes(franja));
}

export function textoEntrega(
  modo: ModoEntrega,
  iso: string,
  franja: FranjaReparto,
) {
  const cuando = `${etiquetaDia(iso)}, ${franja === "manana" ? "9 a 13" : "18 a 20"}`;
  if (modo === "antes_posible") return `Lo antes posible · ${cuando}`;
  return `Programado · ${cuando}`;
}

export function textoProximaEntrega(turno: TurnoReparto) {
  return `${etiquetaDia(turno.iso)}, ${turno.franja === "manana" ? "9 a 13" : "18 a 20"}`;
}
