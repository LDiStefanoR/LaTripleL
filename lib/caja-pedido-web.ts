export const CANAL_CAJA_PEDIDO = "latriplel-caja-pedido";
export const CLAVE_CAJA_PEDIDO = "latriplel-cargar-pedido";

export type CargaPedidoCaja = {
  pedidoId: string;
  numero: string;
  cliente: string;
  email: string;
  telefono: string;
  direccion?: string;
  entrega?: string;
  pago?: string;
  lineas: { codigo: string; cantidad: number; precio?: number }[];
};

export function publicarPedidoEnCaja(carga: CargaPedidoCaja) {
  const texto = JSON.stringify(carga);
  localStorage.setItem(CLAVE_CAJA_PEDIDO, texto);
  try {
    const canal = new BroadcastChannel(CANAL_CAJA_PEDIDO);
    canal.postMessage(carga);
    canal.close();
  } catch {
    /* el otro tab también escucha storage */
  }
}

export function leerPedidoEnCaja(): CargaPedidoCaja | null {
  try {
    const texto = localStorage.getItem(CLAVE_CAJA_PEDIDO);
    if (!texto) return null;
    const data = JSON.parse(texto) as CargaPedidoCaja;
    if (!data?.pedidoId || !Array.isArray(data.lineas)) return null;
    return data;
  } catch {
    return null;
  }
}

export function limpiarPedidoEnCaja() {
  localStorage.removeItem(CLAVE_CAJA_PEDIDO);
}
