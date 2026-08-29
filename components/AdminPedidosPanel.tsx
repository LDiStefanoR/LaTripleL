"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCambiarEstadoPedido, type EstadoAdminCuentas } from "@/app/acciones/cuentas";
import { formatoPesos, nombreVitrina } from "@/lib/format";
import { resumenOperativoPedidos } from "@/lib/pedidos-resumen";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  ETIQUETA_FRANJA,
  ETIQUETA_SI_FALTA,
  type Pedido,
} from "@/types/pedido";

const campo =
  "w-full rounded-lg border border-movipack/20 px-3 py-2 text-sm outline-none focus:border-movipack";

const ESTADO_LABEL: Record<Pedido["estado"], string> = {
  sin_atender: "Sin atender",
  en_proceso: "En proceso",
  terminado: "Entregado",
};

export function AdminPedidosPanel({ pedidos }: { pedidos: Pedido[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"activos" | Pedido["estado"] | "todos">(
    "activos",
  );
  const [tipo, setTipo] = useState<"todos" | "registrado" | "generico">("todos");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<EstadoAdminCuentas>(null);
  const [pending, start] = useTransition();

  const stats = useMemo(() => resumenOperativoPedidos(pedidos), [pedidos]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const tel = t.replace(/\D/g, "");
    return pedidos.filter((p) => {
      if (estado === "activos") {
        if (p.estado !== "sin_atender" && p.estado !== "en_proceso") return false;
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

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          titulo="Pedidos de hoy"
          cantidad={stats.hoy.cantidad}
          total={stats.hoy.total}
        />
        <Tarjeta
          titulo="Esta semana"
          cantidad={stats.semana.cantidad}
          total={stats.semana.total}
        />
        <Tarjeta
          titulo="Este mes"
          cantidad={stats.mes.cantidad}
          total={stats.mes.total}
        />
        <Tarjeta
          titulo="Activos ahora"
          cantidad={stats.activos.cantidad}
          total={stats.activos.total}
          destaque
        />
      </div>

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
                    {pedido.siFaltaProducto
                      ? ` · ${ETIQUETA_SI_FALTA[pedido.siFaltaProducto]}`
                      : ""}
                  </p>
                </div>
                <select
                  key={`${pedido.id}-${pedido.estado}`}
                  defaultValue={pedido.estado}
                  disabled={pending}
                  className="rounded-lg border border-movipack/20 bg-white px-3 py-2 text-sm font-semibold"
                  onChange={(e) => cambiarEstado(pedido.id, e.target.value)}
                >
                  <option value="sin_atender">{ESTADO_LABEL.sin_atender}</option>
                  <option value="en_proceso">{ESTADO_LABEL.en_proceso}</option>
                  <option value="terminado">{ESTADO_LABEL.terminado}</option>
                </select>
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
    </div>
  );
}

function Tarjeta({
  titulo,
  cantidad,
  total,
  destaque,
}: {
  titulo: string;
  cantidad: number;
  total: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        destaque
          ? "border-cape/30 bg-cape text-white"
          : "border-movipack/15 bg-white"
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-wide ${
          destaque ? "text-white/80" : "text-neutral-500"
        }`}
      >
        {titulo}
      </p>
      <p className="mt-1 font-display text-2xl font-bold italic">
        {cantidad}
      </p>
      <p className={`text-sm font-semibold ${destaque ? "text-white" : "text-movipack"}`}>
        {formatoPesos(total)} generado
      </p>
    </div>
  );
}
