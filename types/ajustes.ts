export type AjustesPrecios = {
  descuentoClienteGenerico: number;
  ajustePorSeccion: Record<string, number>;
  /** Si la clave está, ese rubro usa este % en vez del descuento general. */
  descuentoClientePorSeccion: Record<string, number>;
};
