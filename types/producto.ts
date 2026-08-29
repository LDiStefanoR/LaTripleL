import type { TipoOferta } from "@/types/promo";

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  seccion: string;
  precio: number;
  precioMayorista?: number;
  imagen: string;
  descripcion: string;
  promoActiva?: boolean;
  precioPromo?: number;
  precioSuper?: number;
}

export type ProductoVitrina = Producto & {
  precioLista: number;
  precioMostrar: number;
  descuentoCliente: number;
  esPromo: boolean;
  tipoPromo?: TipoOferta;
  enCombo?: boolean;
  notaAdmin?: string;
};

export type ModoPrecio = "publico" | "cliente" | "admin";
