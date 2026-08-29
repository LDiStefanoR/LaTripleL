export type TipoOferta = "2x1" | "3x2" | "precio";

export type Oferta = {
  id: string;
  productoId: string;
  tipo: TipoOferta;
  precioPromo?: number;
  carrusel: boolean;
  activa: boolean;
  creadoEn: string;
};

export type ComboPromo = {
  id: string;
  productoIds: string[];
  precioCombo?: number;
  activa: boolean;
  creadoEn: string;
};

export type AfichePromo = {
  id: string;
  imagen: string;
  creadoEn: string;
};

export type BasePromos = {
  ofertas: Oferta[];
  combos: ComboPromo[];
  afiches: AfichePromo[];
  migrado?: boolean;
};
