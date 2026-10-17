export type TipoTicket = "almacen" | "efectivo";
export type MedioPagoTicket = "local" | "transferencia" | "cuenta" | "web";
export type EstadoTicket = "vigente" | "pagada";
export type TipoPago = "total" | "parcial";
export type EstadoPago = "pendiente" | "confirmado" | "rechazado";
export type TipoSolicitudCuenta = "efectivo" | "pago";
export type EstadoSolicitudCuenta = "pendiente" | "atendida" | "rechazada";
export type TipoNovedad =
  | "efectivo"
  | "pago"
  | "registro"
  | "pedido"
  | "otro";

export type LineaTicket = {
  nombre: string;
  codigo: string;
  monto?: number;
};

export type ClienteFiado = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  pinInicial: string;
  limiteAlmacen: number;
  limiteEfectivo: number;
  /** Compatibilidad: si no hay mora de crédito o de cuenta, se usa esta. */
  moraModo?: "escala" | "fijo" | "sin";
  moraPorcentaje?: number;
  /** Mora semanal si se vence un crédito. */
  moraCreditoModo?: "escala" | "fijo" | "sin";
  moraCreditoPorcentaje?: number;
  /** Mora semanal si se vence la cuenta corriente. */
  moraCuentaModo?: "escala" | "fijo" | "sin";
  moraCuentaPorcentaje?: number;
  /** Dinero ya acreditado, para pagar compras. */
  saldo?: number;
  /** Máximo histórico. Si hay cuotas habilitadas, esas mandan. */
  cuotasMaximas?: 1 | 2 | 3 | 6;
  /** Cuáles de 1, 2, 3 y 6 puede usar. Vacío sigue el máximo. */
  cuotasHabilitadas?: (1 | 2 | 3 | 6)[];
  /** general: tasas de mantenimiento. propio: los intereses de esta ficha. */
  interesModo?: "general" | "propio";
  interes1?: number;
  interes2?: number;
  interes3?: number;
  interes6?: number;
  /** Días para pagar mercadería. Vacío usa el plazo general. */
  plazoCuenta?: number;
  aliasCbu: string;
  activo: boolean;
};

export type TicketDeuda = {
  id: string;
  numero?: string;
  clienteId: string;
  fecha: string;
  vencimiento?: string;
  descripcion: string;
  tipo: TipoTicket;
  total: number;
  debe: number;
  ultimoPago: string | null;
  estado: EstadoTicket;
  origen: string;
  medioPago?: MedioPagoTicket;
  pedidoId?: string;
  adjunto?: string;
  interesDesactivado?: boolean;
  interesManual?: number | null;
  lineas: LineaTicket[];
};

export type PagoCuenta = {
  id: string;
  clienteId: string;
  ticketId: string | null;
  monto: number;
  tipo: TipoPago;
  medio: string;
  nota: string;
  comprobante: string;
  creadoEn: string;
  estado: EstadoPago;
};

export type SolicitudCuenta = {
  id: string;
  clienteId: string;
  tipo: TipoSolicitudCuenta;
  monto: number;
  aliasCbu: string;
  nota: string;
  comprobante: string;
  creadoEn: string;
  estado: EstadoSolicitudCuenta;
};

export type NovedadAdmin = {
  id: string;
  tipo: TipoNovedad;
  titulo: string;
  detalle: string;
  clienteId?: string;
  solicitudId?: string;
  leida: boolean;
  creadoEn: string;
};

export type AjustesCuenta = {
  alias: string;
  cbu: string;
  titular: string;
  banco: string;
  nombreLocal?: string;
  mailLocal?: string;
  telefonoLocal?: string;
  direccionLocal?: string;
  horariosLocal?: string;
  /** Logo para presupuestos y comprobantes. Ruta /recursos/... o URL Blob. */
  logoLocal?: string;
  /** Texto que ve el cliente cuando pide lo antes posible. */
  demoraEntrega?: string;
  limiteAlmacenDefault: number;
  limiteEfectivoDefault: number;
  plazoEfectivoHoras: number;
  importadoEn: string;
  archivoOrigen: string;
  ultimoTicketWeb?: number;
  ultimoTicketTienda?: number;
};

export type BaseCuentas = {
  ajustes: AjustesCuenta;
  clientes: ClienteFiado[];
  tickets: TicketDeuda[];
  pagos: PagoCuenta[];
  solicitudes: SolicitudCuenta[];
  novedades: NovedadAdmin[];
};

export type ResumenCliente = {
  cliente: ClienteFiado;
  saldoTotal: number;
  saldoAlmacen: number;
  saldoEfectivo: number;
  disponibleAlmacen: number;
  disponibleEfectivo: number;
  ticketsVigentes: TicketDeuda[];
  ticketsPagados: TicketDeuda[];
  pagos: PagoCuenta[];
  solicitudesPendientes: SolicitudCuenta[];
};

export type AlertasAdmin = {
  solicitudes: number;
  pedidosNuevos: number;
  novedades: number;
  total: number;
};
