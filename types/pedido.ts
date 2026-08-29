import type { TipoOferta } from "@/types/promo";

export type EstadoPedido = "sin_atender" | "en_proceso" | "terminado";

export type FranjaReparto = "manana" | "tarde";

export type SiFaltaProducto = "reemplazo_misma_marca" | "omitir";

export type ModoEntrega = "antes_posible" | "programado";

export const ETIQUETA_FRANJA: Record<FranjaReparto, string> = {
  manana: "Mañana (9 a 13)",
  tarde: "Tarde (18 a 20)",
};

export const ETIQUETA_SI_FALTA: Record<SiFaltaProducto, string> = {
  reemplazo_misma_marca: "Enviar otro parecido",
  omitir: "Enviar el pedido sin ese producto",
};

export type LineaPedido = {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  precioLista?: number;
  tipoPromo?: TipoOferta;
  cantidad: number;
};

export type ContactoPedido = {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  horarios: string;
};

export type Pedido = {
  id: string;
  numeroTicket?: string;
  creadoEn: string;
  estado: EstadoPedido;
  canal: "web";
  clienteRegistrado: boolean;
  usuarioId?: string;
  contacto: ContactoPedido;
  franjaReparto?: FranjaReparto;
  siFaltaProducto?: SiFaltaProducto;
  modoEntrega?: ModoEntrega;
  fechaEntrega?: string;
  lineas: LineaPedido[];
  total: number;
};
