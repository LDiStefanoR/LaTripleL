import type { Pedido } from "@/types/pedido";

export type TotalesPeriodo = {
  cantidad: number;
  total: number;
};

function inicioDia(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

export function resumenOperativoPedidos(pedidos: Pedido[], ahora = new Date()) {
  const hoy = inicioDia(ahora);
  const semana = hoy - 6 * 86400000;
  const mes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();

  function acumular(desde: number): TotalesPeriodo {
    let cantidad = 0;
    let total = 0;
    for (const p of pedidos) {
      const t = new Date(p.creadoEn).getTime();
      if (t >= desde) {
        cantidad += 1;
        total += p.total;
      }
    }
    return { cantidad, total };
  }

  const activos = pedidos.filter(
    (p) => p.estado === "sin_atender" || p.estado === "en_proceso" || p.estado === "enviando",
  );
  return {
    hoy: acumular(hoy),
    semana: acumular(semana),
    mes: acumular(mes),
    activos: {
      cantidad: activos.length,
      total: activos.reduce((s, p) => s + p.total, 0),
    },
  };
}
