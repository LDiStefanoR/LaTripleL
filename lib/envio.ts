import type { EscalaEnvio } from "@/types/ajustes";
import { formatoPesos } from "@/lib/format";

export const ENVIO_BASE: EscalaEnvio = {
  base: 5_998,
  medioDesde: 15_000,
  medio: 4_890,
  bajoDesde: 30_000,
  bajo: 4_000,
  sinCargoDesde: 60_000,
};

export const ENVIO_SIN_CARGO_DESDE = ENVIO_BASE.sinCargoDesde;

export function escalaEnvio(valor: unknown): EscalaEnvio {
  const raw = valor && typeof valor === "object" ? (valor as Partial<EscalaEnvio>) : {};
  const monto = (campo: unknown, base: number) => {
    const n = Math.round(Number(campo));
    return Number.isFinite(n) && n >= 0 ? n : base;
  };
  const escala: EscalaEnvio = {
    base: monto(raw.base, ENVIO_BASE.base),
    medioDesde: monto(raw.medioDesde, ENVIO_BASE.medioDesde),
    medio: monto(raw.medio, ENVIO_BASE.medio),
    bajoDesde: monto(raw.bajoDesde, ENVIO_BASE.bajoDesde),
    bajo: monto(raw.bajo, ENVIO_BASE.bajo),
    sinCargoDesde: monto(raw.sinCargoDesde, ENVIO_BASE.sinCargoDesde),
  };
  if (!(escala.medioDesde > 0 && escala.bajoDesde > escala.medioDesde && escala.sinCargoDesde > escala.bajoDesde)) {
    return { ...ENVIO_BASE };
  }
  return escala;
}

export function costoEnvio(subtotalProductos: number, escala: EscalaEnvio = ENVIO_BASE) {
  if (subtotalProductos <= 0) return 0;
  if (subtotalProductos >= escala.sinCargoDesde) return 0;
  if (subtotalProductos >= escala.bajoDesde) return escala.bajo;
  if (subtotalProductos >= escala.medioDesde) return escala.medio;
  return escala.base;
}

export function avisoEnvio(subtotalProductos: number, escala: EscalaEnvio = ENVIO_BASE) {
  if (subtotalProductos <= 0) return "El envío se calcula según el total de productos.";
  if (subtotalProductos >= escala.sinCargoDesde) {
    return "Este pedido va con envío sin cargo.";
  }
  const falta = escala.sinCargoDesde - subtotalProductos;
  if (subtotalProductos >= escala.bajoDesde) {
    return `Te faltan ${formatoPesos(falta)} para envío sin cargo.`;
  }
  if (subtotalProductos >= escala.medioDesde) {
    return `Te faltan ${formatoPesos(escala.bajoDesde - subtotalProductos)} para bajar el envío a ${formatoPesos(escala.bajo)}.`;
  }
  return `Te faltan ${formatoPesos(escala.medioDesde - subtotalProductos)} para bajar el envío a ${formatoPesos(escala.medio)}.`;
}

export function etiquetaCostoEnvio(costo: number) {
  return costo > 0 ? "Envío a domicilio" : "Envío a domicilio (sin cargo)";
}
