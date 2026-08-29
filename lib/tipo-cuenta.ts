import type { TipoCuentaCliente } from "@/types/auth";

export const TIPOS_CUENTA_CLIENTE = [
  "generico",
  "descuentos",
  "credito_super",
  "linea_credito",
] as const;

export const ETIQUETA_TIPO_CUENTA: Record<TipoCuentaCliente, string> = {
  generico: "Genérico",
  descuentos: "Con descuentos",
  credito_super: "Crédito supermercado",
  linea_credito: "Línea de crédito",
};

export const DETALLE_TIPO_CUENTA: Record<TipoCuentaCliente, string> = {
  generico: "Ves los precios de lista. Esta cuenta no tiene descuento ni crédito.",
  descuentos:
    "En el catálogo ves tu precio de cliente, más bajo que el de lista. Sin crédito asignado.",
  credito_super:
    "Comprás productos de supermercado a cuenta, con el límite que te asignó el local, y ves precios con descuento.",
  linea_credito:
    "Tenés una línea de crédito habilitada. El monto disponible y el usado los ves en tu perfil, y también ves precios con descuento.",
};

export function esTipoCuentaCliente(valor: unknown): valor is TipoCuentaCliente {
  return (
    valor === "generico" ||
    valor === "descuentos" ||
    valor === "credito_super" ||
    valor === "linea_credito"
  );
}

export function parseTipoCuenta(raw: unknown): TipoCuentaCliente {
  if (raw === "credito") return "credito_super";
  if (esTipoCuentaCliente(raw)) return raw;
  return "generico";
}

export function veDescuentos(tipo?: TipoCuentaCliente | null) {
  return (
    tipo === "descuentos" ||
    tipo === "credito_super" ||
    tipo === "linea_credito"
  );
}

export function tieneCreditoSuper(tipo?: TipoCuentaCliente | null) {
  return tipo === "credito_super";
}

export function tieneLineaCredito(tipo?: TipoCuentaCliente | null) {
  return tipo === "linea_credito";
}

export function mensajeGuardarTipo(tipo: TipoCuentaCliente) {
  if (tipo === "descuentos") return "Quedó como cliente con descuentos.";
  if (tipo === "credito_super") return "Quedó con crédito de supermercado.";
  if (tipo === "linea_credito") return "Quedó con línea de crédito.";
  return "Quedó como cliente genérico: no ve descuentos.";
}
