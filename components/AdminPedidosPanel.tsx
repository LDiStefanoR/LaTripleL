"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminCambiarEstadoPedido, adminCancelarPedido, adminResolverCredito, adminResolverRecarga, type EstadoAdminCuentas } from "@/app/acciones/cuentas";
import { caja } from "@/components/caja-estilo";
import { digitosMonto, formatoPesos, nombreVitrina, textoMonto } from "@/lib/format";
import { fechaHoraVenta } from "@/lib/venta-texto";
import { publicarPedidoEnCaja } from "@/lib/caja-pedido-web";
import { whatsappUrl } from "@/lib/whatsapp";
import type { CreditoPendiente } from "@/lib/cuentas";
import {
  ETIQUETA_FRANJA,
  ETIQUETA_PAGO_PEDIDO,
  type Pedido,
} from "@/types/pedido";

const ESTADO_LABEL: Record<Pedido["estado"], string> = {
  sin_atender: "Sin atender",
  en_proceso: "En proceso",
  enviando: "Enviando pedido",
  terminado: "Entregado",
  cancelado: "Cancelado",
};

const MOTIVOS_RAPIDOS = ["Falta de pago", "El cliente canceló", "Sin stock", "Dirección incorrecta"];

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
  const [cancelando, setCancelando] = useState<Pedido | null>(null);
  const [motivo, setMotivo] = useState("");
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

  function confirmarCancelacion(evento: FormEvent) {
    evento.preventDefault();
    if (!cancelando) return;
    const data = new FormData();
    data.set("id", cancelando.id);
    data.set("motivo", motivo);
    setMensaje(null);
    start(async () => {
      const resultado = await adminCancelarPedido(data);
      setMensaje(resultado);
      if (resultado?.ok) {
        setCancelando(null);
        setMotivo("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className={`${caja.panel} p-4`}>
        <p className={caja.kicker}>Pendientes</p>
        <h2 className="font-display text-2xl font-bold">Crédito y saldo</h2>
        <p className="mt-1 text-sm text-amber-950/80">
          Los pedidos de efectivo y las recargas de saldo se atienden acá, separados de la mercadería. Podés corregir el importe antes de aceptar, por si transfirieron otro monto o no transfirieron.
        </p>
        {creditos.length === 0 && recargas.length === 0 && (
          <p className="mt-3 text-sm text-amber-950/70">No hay créditos ni recargas pendientes.</p>
        )}
        <ul className="mt-3 space-y-3">
          {creditos.map((credito) => (
            <li key={credito.id} className={`${caja.panel} p-3`}>
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
                  className={`${caja.campo} mt-1 max-w-40`}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className={caja.primario}
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
                  className={caja.boton}
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
            <li key={pedido.id} className={`${caja.panel} p-3`}>
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
                  className={`${caja.campo} mt-1 max-w-40`}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className={caja.primario}
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
                  className={caja.boton}
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
        <p className={caja.kicker}>Web</p>
        <h2 className="font-display text-2xl font-bold">Pedidos de mercadería</h2>
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
            className={`${caja.campo} mt-1`}
          />
        </label>
        <label className="text-xs font-bold text-neutral-600">
          Estado
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as typeof estado)}
            className={`${caja.campo} mt-1`}
          >
            <option value="activos">Activos (sin entregar)</option>
            <option value="todos">Todos</option>
            <option value="sin_atender">Sin atender</option>
            <option value="en_proceso">En proceso</option>
            <option value="enviando">Enviando</option>
            <option value="terminado">Entregados</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </label>
        <label className="text-xs font-bold text-neutral-600">
          Cliente
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            className={`${caja.campo} mt-1`}
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

      {mensaje?.error && <p className={caja.avisoErrorPlano}>{mensaje.error}</p>}
      {mensaje?.ok && <p className={caja.avisoOkPlano}>{mensaje.ok}</p>}
      {avisoCaja && <p className={caja.nota}>{avisoCaja}</p>}

      <ul className="space-y-4">
        {filtrados.length === 0 && (
          <li className={`${caja.panel} p-4 text-sm text-neutral-600`}>
            No hay pedidos con ese filtro.
          </li>
        )}
        {filtrados.map((pedido) => {
          const ver = abierto === pedido.id;
          const cuando = fechaHoraVenta(pedido.creadoEn);
          return (
            <li
              key={pedido.id}
              className={`${caja.panel} p-4`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-400">
                    {cuando.dia} {cuando.hora} ·{" "}
                    {pedido.numeroTicket || "Sin n°"} ·{" "}
                    {pedido.clienteRegistrado ? "Registrado" : "Genérico"}
                  </p>
                  <p className="mt-1 font-bold">
                    {pedido.contacto.nombre} · {formatoPesos(pedido.total)}
                  </p>
                  {pedido.estado === "cancelado" && (
                    <p className="mt-1 text-sm font-bold text-cape">
                      Cancelado{pedido.motivoCancelacion ? `: ${pedido.motivoCancelacion}` : ""}
                    </p>
                  )}
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
                <div className="flex min-w-44 flex-col items-stretch gap-2">
                  {pedido.estado !== "terminado" && pedido.estado !== "cancelado" && (
                    <button
                      type="button"
                      className={caja.primario}
                      onClick={() => mandarACaja(pedido)}
                    >
                      Mandar a la caja
                    </button>
                  )}
                  {pedido.estado === "sin_atender" && (
                    <button
                      type="button"
                      disabled={pending}
                      className={caja.boton}
                      onClick={() => cambiarEstado(pedido.id, "en_proceso")}
                    >
                      Poner en proceso
                    </button>
                  )}
                  {pedido.estado !== "cancelado" && (
                    <select
                      key={`${pedido.id}-${pedido.estado}`}
                      defaultValue={pedido.estado}
                      disabled={pending}
                      className={caja.campo}
                      onChange={(e) => cambiarEstado(pedido.id, e.target.value)}
                    >
                      <option value="sin_atender">{ESTADO_LABEL.sin_atender}</option>
                      <option value="en_proceso">{ESTADO_LABEL.en_proceso}</option>
                      <option value="enviando">{ESTADO_LABEL.enviando}</option>
                      <option value="terminado">{ESTADO_LABEL.terminado}</option>
                    </select>
                  )}
                  {pedido.estado !== "terminado" && pedido.estado !== "cancelado" && (
                    <button
                      type="button"
                      className={`${caja.boton} border-cape/40 text-cape`}
                      onClick={() => {
                        setCancelando(pedido);
                        setMotivo("");
                        setMensaje(null);
                      }}
                    >
                      Cancelar pedido
                    </button>
                  )}
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
      {cancelando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={confirmarCancelacion} className={`${caja.popup} max-w-md`}>
            <p className={caja.kicker}>Pedido {cancelando.numeroTicket || ""}</p>
            <h2 className="font-display text-2xl font-bold">Motivo de la cancelación</h2>
            <p className="mt-1 text-sm text-neutral-600">
              {cancelando.contacto.nombre} · {formatoPesos(cancelando.total)}. El motivo queda registrado en el pedido.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MOTIVOS_RAPIDOS.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  className={`${caja.chip} ${motivo === opcion ? caja.chipActivo : caja.chipIdle}`}
                  onClick={() => setMotivo(opcion)}
                >
                  {opcion}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm font-bold">
              Motivo
              <textarea
                required
                minLength={3}
                maxLength={240}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por ejemplo, falta de pago"
                className={`${caja.campo} mt-1 min-h-24`}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={caja.boton}
                onClick={() => {
                  setCancelando(null);
                  setMotivo("");
                }}
              >
                Volver
              </button>
              <button type="submit" disabled={pending} className={caja.peligroAlto}>
                {pending ? "Cancelando…" : "Confirmar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
