export type EstadoCobroTicket = "impago" | "parcial" | "abonado";
export type SemaforoDeuda = "verde" | "amarillo" | "rojo";

export const AVISO_INTERES =
  "Pasada la fecha de vencimiento, si no se registra el abono, la deuda genera interés sobre el capital: 1ª semana 5%, 2ª semana 10%, 3ª semana 20% y 4ª semana 40%.";

export const ETIQUETA_COBRO: Record<EstadoCobroTicket, string> = {
  impago: "Sin abonar",
  parcial: "Abonado parcialmente",
  abonado: "Abonado",
};

export const MORA_BASE = [5, 10, 20, 40] as const;

const TASAS = [0, 0.05, 0.1, 0.2, 0.4];

export function escalaMora(valores?: readonly number[] | null) {
  const base = valores && valores.length >= 4 ? valores : MORA_BASE;
  const porcentajes = [0, 1, 2, 3].map((i) => {
    const n = Number(base[i]);
    const porcentaje = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : MORA_BASE[i];
    return porcentaje / 100;
  });
  return [0, ...porcentajes];
}

export function textoEscalaMora(titulo: string, valores?: readonly number[] | null) {
  const escala = escalaMora(valores);
  const porcentaje = (indice: number) => Math.round(escala[indice] * 1000) / 10;
  return `${titulo}: 1ª semana ${porcentaje(1)}%, 2ª semana ${porcentaje(2)}%, 3ª semana ${porcentaje(3)}% y 4ª semana ${porcentaje(4)}%.`;
}

function fechaIso(valor: string) {
  const d = valor.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10);
}

function masDias(fecha: string, dias: number) {
  const d = new Date(`${fechaIso(fecha)}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string) {
  const a = new Date(`${fechaIso(desde)}T12:00:00`).getTime();
  const b = new Date(`${fechaIso(hasta)}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function vencimientoDeTicket(ticket: {
  fecha: string;
  vencimiento?: string;
}) {
  return ticket.vencimiento
    ? fechaIso(ticket.vencimiento)
    : masDias(ticket.fecha, 7);
}

export function estadoCobroTicket(ticket: {
  total: number;
  debe: number;
  estado?: string;
}): EstadoCobroTicket {
  if (ticket.debe <= 0 || ticket.estado === "pagada") return "abonado";
  if (ticket.debe < ticket.total) return "parcial";
  return "impago";
}

export type TicketInteres = {
  debe: number;
  fecha: string;
  vencimiento?: string;
  estado?: string;
  tipo?: "efectivo" | "almacen";
  interesDesactivado?: boolean;
  interesManual?: number | null;
};

export type PoliticaMora = {
  moraModo?: "escala" | "fijo" | "sin";
  moraPorcentaje?: number;
  moraCreditoModo?: "escala" | "fijo" | "sin";
  moraCreditoPorcentaje?: number;
  moraCuentaModo?: "escala" | "fijo" | "sin";
  moraCuentaPorcentaje?: number;
  moraCredito?: readonly number[];
  moraCuenta?: readonly number[];
};

export function semanasMora(
  ticket: TicketInteres,
  hoy = new Date().toISOString().slice(0, 10),
) {
  if (ticket.debe <= 0 || ticket.estado === "pagada") return 0;
  const vencidos = diasEntre(vencimientoDeTicket(ticket), hoy);
  if (vencidos <= 0) return 0;
  return Math.min(4, Math.ceil(vencidos / 7));
}

export function interesSobreCapital(
  debe: number,
  vencimiento: string,
  hoy = new Date().toISOString().slice(0, 10),
) {
  if (debe <= 0) return { tasa: 0, interes: 0, semanas: 0 };
  const vencidos = diasEntre(vencimiento, hoy);
  if (vencidos <= 0) return { tasa: 0, interes: 0, semanas: 0 };
  const semanas = Math.min(4, Math.ceil(vencidos / 7));
  const tasa = TASAS[semanas] ?? 0.4;
  return {
    tasa,
    interes: Math.round(debe * tasa),
    semanas,
  };
}

export function interesDeTicket(
  ticket: TicketInteres,
  hoy = new Date().toISOString().slice(0, 10),
  politica?: PoliticaMora,
) {
  const semanas = semanasMora(ticket, hoy);
  const esCredito = ticket.tipo === "efectivo";
  const modo = esCredito
    ? (politica?.moraCreditoModo ?? politica?.moraModo)
    : (politica?.moraCuentaModo ?? politica?.moraModo);
  const porcentaje = esCredito
    ? (politica?.moraCreditoPorcentaje ?? politica?.moraPorcentaje)
    : (politica?.moraCuentaPorcentaje ?? politica?.moraPorcentaje);
  const escala = escalaMora(esCredito ? politica?.moraCredito : politica?.moraCuenta);
  const tasaEscala = escala[semanas] ?? 0;
  const tasaFija = Math.min(100, Math.max(0, Math.round(porcentaje ?? 0))) / 100;
  const tasa =
    modo === "sin"
      ? 0
      : modo === "fijo"
        ? semanas > 0
          ? tasaFija
          : 0
        : tasaEscala;
  const automatico = Math.round((ticket.debe || 0) * tasa);
  if (
    ticket.debe <= 0 ||
    ticket.estado === "pagada" ||
    ticket.interesDesactivado ||
    modo === "sin"
  ) {
    return { tasa: 0, interes: 0, semanas, automatico, manual: false };
  }
  if (typeof ticket.interesManual === "number" && ticket.interesManual >= 0) {
    return {
      tasa,
      interes: Math.round(ticket.interesManual),
      semanas,
      automatico,
      manual: true,
    };
  }
  return { tasa, interes: automatico, semanas, automatico, manual: false };
}

export function interesTotalDeuda(tickets: TicketInteres[], politica?: PoliticaMora) {
  return tickets.reduce((acc, t) => acc + interesDeTicket(t, undefined, politica).interes, 0);
}

export function semaforoTicket(
  ticket: TicketInteres,
  hoy = new Date().toISOString().slice(0, 10),
): SemaforoDeuda {
  if (ticket.debe <= 0 || ticket.estado === "pagada") return "verde";
  const semanas = semanasMora(ticket, hoy);
  if (semanas >= 2) return "rojo";
  if (semanas >= 1) return "amarillo";
  return "verde";
}

export function semaforoDeuda(
  tickets: TicketInteres[],
  hoy = new Date().toISOString().slice(0, 10),
): SemaforoDeuda {
  const vigentes = tickets.filter((t) => t.debe > 0 && t.estado !== "pagada");
  if (vigentes.length === 0) return "verde";
  if (vigentes.some((t) => semaforoTicket(t, hoy) === "rojo")) return "rojo";
  if (vigentes.some((t) => semaforoTicket(t, hoy) === "amarillo")) {
    return "amarillo";
  }
  return "verde";
}

export function numeroVisibleTicket(ticket: { id: string; numero?: string }) {
  return ticket.numero?.trim() || ticket.id;
}
