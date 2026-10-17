export type TasasCuota = { 1: number; 2: number; 3: number; 6: number };

/** Porcentajes de la 1ª a la 4ª semana de atraso. */
export type EscalaMora = [number, number, number, number];

export type AjustesPrecios = {
  descuentoClienteGenerico: number;
  ajustePorSeccion: Record<string, number>;
  /** Si la clave está, ese rubro usa este % en vez del descuento general. */
  descuentoClientePorSeccion: Record<string, number>;
  /** Interés de simulación si la ficha no carga uno propio. */
  tasasCuota: TasasCuota;
  moraCredito: EscalaMora;
  moraCuenta: EscalaMora;
  /** Días para pagar mercadería antes de que empiece la mora. */
  plazoCuenta: number;
  /** Escala de envío a domicilio. Los cortes y los costos se editan en mantenimiento. */
  envio: EscalaEnvio;
};

export type EscalaEnvio = {
  /** Costo si el pedido no llega al primer corte. */
  base: number;
  /** A partir de este total de productos baja el envío. */
  medioDesde: number;
  medio: number;
  /** A partir de este total baja otra vez. */
  bajoDesde: number;
  bajo: number;
  /** A partir de este total el envío no se cobra. */
  sinCargoDesde: number;
};
