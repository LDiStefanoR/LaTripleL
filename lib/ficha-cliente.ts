import { interesTotalDeuda } from "@/lib/deuda";
import { politicaDeCliente } from "@/lib/politica-cliente";
import type { UsuarioPublico } from "@/types/auth";
import type { ResumenCliente } from "@/types/cuenta";
import type { Pedido } from "@/types/pedido";

export function resumenOperativoFicha(
  usuario: UsuarioPublico,
  resumen: ResumenCliente | null,
  pedidos: Pedido[],
) {
  const tickets = [
    ...(resumen?.ticketsVigentes ?? []),
    ...(resumen?.ticketsPagados ?? []),
  ];
  const idsPedido = new Set(
    tickets.map((t) => t.pedidoId).filter((id): id is string => Boolean(id)),
  );
  const extra = pedidos.filter((p) => !idsPedido.has(p.id));
  const vendido =
    tickets.reduce((s, t) => s + t.total, 0) +
    extra.reduce((s, p) => s + p.total, 0);
  const fechas = [
    ...tickets.map((t) => t.fecha),
    ...pedidos.map((p) => p.creadoEn),
  ]
    .filter(Boolean)
    .sort();
  return {
    email: usuario.email,
    vendido,
    comprobantes: tickets.length,
    pedidos: pedidos.length,
    deuda: resumen?.saldoTotal ?? 0,
    mora: interesTotalDeuda(resumen?.ticketsVigentes ?? [], politicaDeCliente(resumen?.cliente)),
    clienteFiadoId: resumen?.cliente.id,
    ultimaActividad: fechas.at(-1) ?? usuario.creadoEn,
  };
}
