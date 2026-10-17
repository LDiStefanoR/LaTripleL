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
  /** Unidades en el local. Sin número, todavía no se controla el stock. */
  stock?: number;
  /** Costo de compra. No se publica en el catálogo. */
  costo?: number;
  /** Porcentaje de ganancia sobre el costo. El precio de venta sale de costo × (1 + margen / 100). */
  margen?: number;
  /** Aviso para reponer. No se publica en el catálogo. */
  stockMinimo?: number;
  /** Proveedor habitual de este producto. */
  proveedorId?: string;
  /** Códigos de barra además del código interno. */
  codigosBarra?: string[];
  mostrarEnCaja?: boolean;
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
