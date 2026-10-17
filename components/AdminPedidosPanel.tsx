"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCambiarEstadoPedido, adminResolverCredito, adminResolverRecarga, type EstadoAdminCuentas } from "@/app/acciones/cuentas";
import { digitosMonto, formatoPesos, nombreVitrina, textoMonto } from "@/lib/format";
import { publicarPedidoEnCaja } from "@/lib/caja-pedido-web";
import { whatsappUrl } from "@/lib/whatsapp";
import type { CreditoPendiente } from "@/lib/cuentas";
import {
  ETIQUETA_FRANJA,
  ETIQUETA_PAGO_PEDIDO,
  type Pedido,
} from "@/types/pedido";

const campo =
  "w-full rounded-lg border border-movipack/20 px-3 py-2 text-sm outline-none focus:border-movipack";

const ESTADO_LABEL: Record<Pedido["estado"], string> = {
  sin_atender: "Sin atender",
  en_proceso: "En proceso",
  enviando: "Enviando pedido",
  terminado: "Entregado",
};

export function AdminPedidosPanel({
  pedidos,
  creditos,
}: {
  pedidos: Pedido[];
  creditos: CreditoPendiente[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"activos" | Pedido["estado"] | "todos">(
    "activos",
  );
  const [tipo, setTipo] = useState<"todos" | "registrado" | "generico">("todos");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<EstadoAdminCuentas>(null);
  const [avisoCaja, setAvisoCaja] = useState("");
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const tel = t.replace(/\D/g, "");
    return pedidos.filter((p) => {
      if (p.esRecarga) return false;
      if (estado === "activos") {
        if (p.estado !== "sin_atender" && p.estado !== "en_proceso" && p.estado !== "enviando") return false;
      } else if (estado !== "todos" && p.estado !== estado) return false;
      if (tipo === "registrado" && !p.clienteRegistrado) return false;
      if (tipo === "generico" && p.clienteRegistrado) return false;
      if (!t) return true;
      const blob = [
        p.numeroTicket,
        p.contacto.nombre,
        p.contacto.email,
        p.contacto.telefono,
        p.contacto.direccion,
        ...p.lineas.map((l) => `${l.nombre} ${l.codigo}`),
      ]
        .join(" ")
        .toLowerCase();
      if (blob.includes(t)) return true;
      if (tel && p.contacto.telefono.replace(/\D/g, "").includes(tel)) return true;
      return false;
    });
  }, [pedidos, q, estado, tipo]);

  function cambiarEstado(id: string, valor: string) {
    const data = new FormData();
    data.set("id", id);
    data.set("estado", valor);
    setMensaje(null);
    start(async () => {
      const resultado = await adminCambiarEstadoPedido(data);
      setMensaje(resultado);
      if (resultado?.ok) router.refresh();
    });
  }

  const recargas = pedidos.filter((p) => p.esRecarga && !p.recargaAcreditada && !p.recargaRechazada);

  function montoDe(id: string, base: number) {
    return montos[id] ?? String(base);
  }

  function mandarACaja(pedido: Pedido) {
    const lineas = pedido.lineas
      .filter((linea) => linea.codigo && linea.codigo !== "RECARGA" && linea.cantidad > 0)
      .map((linea) => ({
        codigo: linea.codigo,
        cantidad: linea.cantidad,
        precio: Math.max(0, Math.round(linea.precio) || 0),
      }));
    if (lineas.length === 0) {
      setAvisoCaja("Ese pedido no tiene productos para cargar en la caja.");
      return;
    }
    const pago = pedido.pago;
    const partesPago = pago
      ? [
          pago.transferencia > 0 ? `Transferencia ${formatoPesos(pago.transferencia)}` : "",
          (pago.saldo ?? 0) > 0 ? `Saldo a cuenta ${formatoPesos(pago.saldo ?? 0)}` : "",
          pago.cuentaCorriente > 0 ? `Cuenta corriente ${formatoPesos(pago.cuentaCorriente)}` : "",
        ].filter(Boolean)
      : [];
    const entrega = [
      pedido.modoEntrega === "antes_posible" ? "Lo antes posible" : "",
      pedido.modoEntrega === "programado" && pedido.fechaEntrega ? pedido.fechaEntrega : "",
      pedido.franjaReparto ? ETIQUETA_FRANJA[pedido.franjaReparto] : "",
    ]
      .filter(Boolean)
      .join(" · ");
    publicarPedidoEnCaja({
      pedidoId: pedido.id,
      numero: pedido.numeroTicket || pedido.id.slice(0, 6),
      cliente: pedido.contacto.nombre,
      email: pedido.contacto.email,
      telefono: pedido.contacto.telefono,
      direccion: pedido.contacto.direccion,
      entrega,
      pago: partesPago.join(" · ") || (pago ? ETIQUETA_PAGO_PEDIDO[pago.forma] : ""),
      lineas,
    });
    setAvisoCaja(`Mandamos el pedido ${pedido.numeroTicket || ""} a la caja. Si la caja está abierta en otra pestaña, los productos ya quedaron cargados.`);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-display text-2xl font-bold text-amber-950">Crédito y saldo</h2>
        <p className="mt-1 text-sm text-amber-950/80">
          Los pedidos de efectivo y las recargas de saldo se atienden acá, separados de la mercadería. Podés corregir el importe antes de aceptar, por si transfirieron otro monto o no transfirieron.
        </p>
        {creditos.length === 0 && recargas.length === 0 && (
          <p className="mt-3 text-sm text-amber-950/70">No hay créditos ni recargas pendientes.</p>
        )}
        <ul className="mt-3 space-y-3">
          {creditos.map((credito) => (
            <li key={credito.id} className="rounded-2xl bg-white p-3">
              <p className="font-bold">Crédito solicitado · {credito.nombre}</p>
              <p className="text-sm text-neutral-600">
                Acreditar en {credito.aliasCbu || "sin alias"}
                {credito.nota ? ` · ${credito.nota}` : ""}
              </p>
              <label className="mt-2 block text-xs font-bold text-neutral-600">
                Importe a aceptar
                <input
                  inputMode="numeric"
                  value={textoMonto(montoDe(credito.id, credito.monto))}
                  onChange={(e) => setMontos((prev) => ({ ...prev, [credito.id]: digitosMonto(e.target.value) }))}
                  className={`${campo} mt-1 max-w-40`}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", credito.id);
                    data.set("aceptar", "1");
                    data.set("monto", montoDe(credito.id, credito.monto));
                    start(async () => {
                      const resultado = await adminResolverCredito(data);
                      setMensaje(resultado);
                      if (resultado?.ok) router.refresh();
                    });
                  }}
                >
                  Aceptar crédito
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold"
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", credito.id);
                    data.set("aceptar", "0");
                    data.set("monto", "0");
                    start(async () => {
                      const resultado = await adminResolverCredito(data);
                      setMensaje(resultado);
                      if (resultado?.ok) router.refresh();
                    });
                  }}
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
          {recargas.map((pedido) => (
            <li key={pedido.id} className="rounded-2xl bg-white p-3">
              <p className="font-bold">Saldo a cuenta · {pedido.contacto.nombre}</p>
              <p className="text-sm text-neutral-600">
                {pedido.contacto.email} · avisó una transferencia de {formatoPesos(pedido.total)}
              </p>
              <label className="mt-2 block text-xs font-bold text-neutral-600">
                Importe que sí entró
                <input
                  inputMode="numeric"
                  value={textoMonto(montoDe(pedido.id, pedido.total))}
                  onChange={(e) => setMontos((prev) => ({ ...prev, [pedido.id]: digitosMonto(e.target.value) }))}
                  className={`${campo} mt-1 max-w-40`}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", pedido.id);
                    data.set("acreditar", "1");
                    data.set("monto", montoDe(pedido.id, pedido.total));
                    start(async () => {
                      const resultado = await adminResolverRecarga(data);
                      setMensaje(resultado);
                      if (resultado?.ok) router.refresh();
                    });
                  }}
                >
                  Acreditar saldo
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold"
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", pedido.id);
                    data.set("acreditar", "0");
                    start(async () => {
                      const resultado = await adminResolverRecarga(data);
                      setMensaje(resultado);
                      if (resultado?.ok) router.refresh();
                    });
                  }}
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold text-movipack-deep">Pedidos de mercadería</h2>
        <p className="text-sm text-neutral-600">
          Mandá el pedido a la caja para cobrarlo con los productos ya cargados. Al cerrar la venta pasa a enviando y, 30 minutos después, queda entregado.
        </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-bold text-neutral-600 sm:col-span-3">
          Buscar
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, mail, teléfono, ticket o producto"
            className={`${campo} mt-1`}
          />
        </label>
        <label className="text-xs font-bold text-neutral-600">
          Estado
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as typeof estado)}
            className={`${campo} mt-1`}
          >
            <option value="activos">Activos (sin entregar)</option>
            <option value="todos">Todos</option>
            <option value="sin_atender">Sin atender</option>
            <option value="en_proceso">En proceso</option>
            <option value="enviando">Enviando</option>
            <option value="terminado">Entregados</option>
          </select>
        </label>
        <label className="text-xs font-bold text-neutral-600">
          Cliente
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            className={`${campo} mt-1`}
          >
            <option value="todos">Todos</option>
            <option value="registrado">Registrados</option>
            <option value="generico">Genéricos / sin cuenta</option>
          </select>
        </label>
        <p className="self-end text-sm text-neutral-500">
          {filtrados.length} resultado{filtrados.length === 1 ? "" : "s"}
        </p>
      </div>

      {mensaje?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-cape">
          {mensaje.error}
        </p>
      )}
      {mensaje?.ok && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {mensaje.ok}
        </p>
      )}
      {avisoCaja && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
          {avisoCaja}
        </p>
      )}

      <ul className="space-y-4">
        {filtrados.length === 0 && (
          <li className="rounded-2xl bg-white p-4 text-sm text-neutral-600 shadow-sm">
            No hay pedidos con ese filtro.
          </li>
        )}
        {filtrados.map((pedido) => {
          const ver = abierto === pedido.id;
          return (
            <li
              key={pedido.id}
              className="rounded-2xl border border-movipack/15 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-400">
                    {new Date(pedido.creadoEn).toLocaleString("es-AR")} ·{" "}
                    {pedido.numeroTicket || "Sin n°"} ·{" "}
                    {pedido.clienteRegistrado ? "Registrado" : "Genérico"}
                  </p>
                  <p className="mt-1 font-bold text-movipack-deep">
                    {pedido.contacto.nombre} · {formatoPesos(pedido.total)}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {pedido.contacto.direccion}
                    <br />
                    Tel. {pedido.contacto.telefono} · {pedido.contacto.email}
                    <br />
                    {pedido.contacto.horarios ||
                      (pedido.franjaReparto
                        ? ETIQUETA_FRANJA[pedido.franjaReparto]
                        : "")}
                    {pedido.pago
                      ? ` · ${ETIQUETA_PAGO_PEDIDO[pedido.pago.forma]}${
                          pedido.pago.forma === "mixto"
                            ? ` (cuenta ${formatoPesos(pedido.pago.cuentaCorriente)} + transferencia ${formatoPesos(pedido.pago.transferencia)})`
                            : ""
                        }`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-2">
                  {pedido.estado !== "terminado" && (
                    <button
                      type="button"
                      className="rounded-lg bg-movipack px-3 py-2 text-sm font-bold text-white"
                      onClick={() => mandarACaja(pedido)}
                    >
                      Mandar a la caja
                    </button>
                  )}
                  {pedido.estado === "sin_atender" && (
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-lg bg-cape px-3 py-2 text-sm font-bold text-white hover:bg-cape/90 disabled:opacity-60"
                      onClick={() => cambiarEstado(pedido.id, "en_proceso")}
                    >
                      Poner en proceso
                    </button>
                  )}
                  <select
                    key={`${pedido.id}-${pedido.estado}`}
                    defaultValue={pedido.estado}
                    disabled={pending}
                    className="rounded-lg border border-movipack/20 bg-white px-3 py-2 text-sm font-semibold"
                    onChange={(e) => cambiarEstado(pedido.id, e.target.value)}
                  >
                    <option value="sin_atender">{ESTADO_LABEL.sin_atender}</option>
                    <option value="en_proceso">{ESTADO_LABEL.en_proceso}</option>
                    <option value="enviando">{ESTADO_LABEL.enviando}</option>
                    <option value="terminado">{ESTADO_LABEL.terminado}</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                <button
                  type="button"
                  className="text-movipack underline"
                  onClick={() => setAbierto(ver ? null : pedido.id)}
                >
                  {ver ? "Ocultar desglose" : "Ver desglose"}
                </button>
                <a
                  href={whatsappUrl(
                    `Hola ${pedido.contacto.nombre}, te escribimos de La Triple L por tu pedido ${pedido.numeroTicket || ""}.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#128C7E] underline"
                >
                  WhatsApp al cliente
                </a>
              </div>
              {ver && (
                <ul className="mt-3 space-y-1 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  {pedido.lineas.map((linea) => (
                    <li key={`${pedido.id}-${linea.id}`}>
                      {linea.cantidad} × {nombreVitrina(linea.nombre)} (cód.{" "}
                      {linea.codigo}) — {formatoPesos(linea.precio * linea.cantidad)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      </section>
    </div>
  );
}
