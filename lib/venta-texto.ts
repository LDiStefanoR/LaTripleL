export function diaArgentina(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(fecha);
}

export function nombreVisible(persona: { nombre: string; apellido?: string }) {
  return [persona.nombre, persona.apellido].map((t) => t?.trim()).filter(Boolean).join(" ");
}

export function etiquetaFormaPago(forma: string) {
  if (forma === "contado") return "Contado";
  if (forma === "tarjeta") return "Tarjeta";
  if (forma === "moto") return "Moto";
  if (forma === "deuda") return "Deuda";
  return forma;
}

export function fechaHoraVenta(iso: string) {
  const fecha = new Date(iso);
  const dia = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(fecha);
  return { dia, hora };
}
