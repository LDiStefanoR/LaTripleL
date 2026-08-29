import { formatoPesos } from "@/lib/format";

/** Sin pedido mínimo. El envío se calcula sobre el subtotal de productos. */
export const ENVIO_SIN_CARGO_DESDE = 60_000;

export function costoEnvio(subtotalProductos: number) {
  if (subtotalProductos <= 0) return 0;
  if (subtotalProductos >= ENVIO_SIN_CARGO_DESDE) return 0;
  if (subtotalProductos >= 30_000) return 4_000;
  if (subtotalProductos >= 15_000) return 4_890;
  return 5_998;
}

export function avisoEnvio(subtotalProductos: number) {
  if (subtotalProductos <= 0) return "El envío se calcula según el total de productos.";
  if (subtotalProductos >= ENVIO_SIN_CARGO_DESDE) {
    return "Este pedido va con envío sin cargo.";
  }
  const falta = ENVIO_SIN_CARGO_DESDE - subtotalProductos;
  if (subtotalProductos >= 30_000) {
    return `Te faltan ${formatoPesos(falta)} para envío sin cargo.`;
  }
  if (subtotalProductos >= 15_000) {
    return `Te faltan ${formatoPesos(30_000 - subtotalProductos)} para bajar el envío a ${formatoPesos(4_000)}.`;
  }
  return `Te faltan ${formatoPesos(15_000 - subtotalProductos)} para bajar el envío a ${formatoPesos(4_890)}.`;
}

export function etiquetaCostoEnvio(costo: number) {
  return costo > 0 ? "Envío a domicilio" : "Envío a domicilio (sin cargo)";
}
