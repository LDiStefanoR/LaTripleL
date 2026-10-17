"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { caja } from "@/components/caja-estilo";
import { digitosMonto, formatoPesos, textoMonto } from "@/lib/format";
import type { CargaPedidoCaja } from "@/lib/caja-pedido-web";
import type { MedioPago } from "@/lib/medios-pago";
import { etiquetaFormaPago, fechaHoraVenta, nombreVisible } from "@/lib/venta-texto";
import type { PersonaCaja } from "@/components/CajaDeposito";

export type PagoCierre = string;

const TECLAS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "00", "←"];

export type LineaCierre = {
  codigo: string;
  nombre: string;
  cantidad: number;
  precio: number;
};

export type ComprobanteCaja = {
  id: string;
  numero: number;
  forma: string;
  cliente: string;
  total: number;
  lineas: LineaCierre[];
};

export type VentaRapida = {
  id: string;
  numero: number;
  creadoEn: string;
  cliente: string;
  formaPago: string;
  total: number;
  lineas: { nombre: string; cantidad: number; precio: number }[];
};

export function CajaCierre({
  total,
  articulos,
  lineas,
  personas,
  clienteInicial,
  clienteFicha = null,
  pedidoWeb = null,
  onCliente,
  pending,
  comprobante,
  medios,
  ventas,
  onVolver,
  onCobrar,
  onDeuda,
  onNueva,
}: {
  total: number;
  articulos: number;
  lineas: LineaCierre[];
  personas: PersonaCaja[];
  clienteInicial: string;
  clienteFicha?: PersonaCaja | null;
  pedidoWeb?: CargaPedidoCaja | null;
  onCliente?: (persona: PersonaCaja | null) => void;
  pending: boolean;
  comprobante: ComprobanteCaja | null;
  medios: MedioPago[];
  ventas: VentaRapida[];
  onVolver: () => void;
  onCobrar: (datos: {
    cliente: string;
    formaPago: PagoCierre;
    email: string;
    clienteId?: string;
    efectivoMixto?: number;
    transferenciaMixto?: number;
  }) => void;
  onDeuda: (datos: { cliente: string; email: string; telefono: string; clienteId?: string }) => void;
  onNueva: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<PersonaCaja | null>(clienteFicha);
  const [nombre, setNombre] = useState(
    clienteFicha ? nombreVisible(clienteFicha) : clienteInicial || "Cliente genérico",
  );
  const efectivoInicial = medios.find((m) => m.efectivo) ?? medios[0];
  const [pago, setPago] = useState(efectivoInicial?.id ?? "contado");
  const [entrega, setEntrega] = useState("");
  const [efectivoMixto, setEfectivoMixto] = useState("");
  const [transferenciaMixto, setTransferenciaMixto] = useState("");
  const [verVentas, setVerVentas] = useState(false);
  const [aviso, setAviso] = useState("");
  const campoEntrega = useRef<HTMLInputElement>(null);
  const esMixto = pago === "mixto";
  const medio = medios.find((m) => m.id === pago) ?? efectivoInicial;
  const esEfectivo = !esMixto && medio?.efectivo !== false;

  const clientes = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const tel = q.replace(/\D/g, "");
    return personas
      .filter((p) => p.rol === "cliente")
      .filter((p) => {
        if (!q) return true;
        const blob = `${p.nombre} ${p.email} ${p.telefono}`.toLowerCase();
        if (blob.includes(q)) return true;
        if (tel && p.telefono.replace(/\D/g, "").includes(tel)) return true;
        return false;
      })
      .slice(0, 8);
  }, [personas, busqueda]);

  const entregaNum = Number(digitosMonto(entrega)) || 0;
  const efectivoNum = Number(digitosMonto(efectivoMixto)) || 0;
  const transferenciaNum = Number(digitosMonto(transferenciaMixto)) || 0;
  const pagoCubre = !esEfectivo || entregaNum === 0 || entregaNum >= total;
  const listoTerminar = esEfectivo && entregaNum >= total;
  const vuelto = listoTerminar ? entregaNum - total : 0;
  const faltaMixto = total - efectivoNum - transferenciaNum;

  useEffect(() => {
    if (esEfectivo) campoEntrega.current?.focus();
  }, [esEfectivo]);

  function elegir(persona: PersonaCaja) {
    setElegido(persona);
    setNombre(nombreVisible(persona));
    setBusqueda("");
    setAviso("");
    onCliente?.(persona);
  }

  function cobrar() {
    if (esMixto) {
      if (efectivoNum < 1 || transferenciaNum < 1) {
        setAviso("Cargá cuánto entra en efectivo y cuánto por transferencia.");
        return;
      }
      if (efectivoNum + transferenciaNum !== total) {
        setAviso("Efectivo más transferencia tiene que dar el total.");
        return;
      }
      setAviso("");
      const cliente = datosCliente();
      onCobrar({
        cliente: cliente.cliente,
        formaPago: "mixto",
        email: cliente.email,
        clienteId: cliente.clienteId,
        efectivoMixto: efectivoNum,
        transferenciaMixto: transferenciaNum,
      });
      return;
    }
    if (esEfectivo && entregaNum > 0 && entregaNum < total) {
      setAviso("Lo que paga el cliente no alcanza para cubrir el total.");
      return;
    }
    setAviso("");
    const cliente = datosCliente();
    onCobrar({
      cliente: cliente.cliente,
      formaPago: medio?.nombre ?? "Contado",
      email: cliente.email,
      clienteId: cliente.clienteId,
    });
  }

  function datosCliente() {
    if (pedidoWeb) {
      const ficha =
        elegido ??
        personas.find(
          (p) => pedidoWeb.email && p.email.toLowerCase() === pedidoWeb.email.toLowerCase(),
        ) ??
        null;
      return {
        cliente: pedidoWeb.cliente || "Cliente genérico",
        email: pedidoWeb.email || ficha?.email || "",
        telefono: pedidoWeb.telefono || ficha?.telefono || "",
        clienteId: ficha?.id,
      };
    }
    return {
      cliente: nombre.trim() || "Cliente genérico",
      email: elegido?.email ?? "",
      telefono: elegido?.telefono ?? "",
      clienteId: elegido?.id,
    };
  }

  function deuda() {
    const cliente = datosCliente();
    if (!cliente.email.includes("@")) {
      setAviso("Elegí un cliente cargado para dejar la venta en deuda.");
      return;
    }
    setAviso("");
    onDeuda({
      cliente: cliente.cliente,
      email: cliente.email,
      telefono: cliente.telefono,
      clienteId: cliente.clienteId,
    });
  }

  if (comprobante) {
    return (
      <section className="mx-auto max-w-xl px-4 py-8">
        <h2 className="text-center font-display text-3xl font-bold">Factura {comprobante.numero}</h2>
        <p className="mt-2 text-center text-sm">
          {comprobante.cliente} · {etiquetaFormaPago(comprobante.forma)} · {formatoPesos(comprobante.total)}
        </p>
        <ul className={`${caja.panel} mt-4`}>
          {comprobante.lineas.map((linea) => (
            <li
              key={`${linea.codigo}-${linea.nombre}`}
              className="flex items-baseline justify-between gap-3 border-b border-neutral-200 px-3 py-2 text-sm last:border-0"
            >
              <span>
                <span className="font-black">{linea.cantidad}</span> {linea.nombre}
              </span>
              <span className="font-bold">{formatoPesos(linea.precio * linea.cantidad)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-3">
          <a
            href={`/caja/comprobante/${comprobante.id}?formato=a4`}
            className={`${caja.boton} py-4 text-center text-lg`}
          >
            Descargar factura A4
          </a>
          <a
            href={`/caja/comprobante/${comprobante.id}?formato=ticket`}
            className={`${caja.boton} py-4 text-center text-lg`}
          >
            Descargar ticket
          </a>
          <button type="button" onClick={onNueva} className={`${caja.primario} py-4 text-lg`}>
            Nueva venta
          </button>
        </div>
      </section>
    );
  }

  const etiquetaCobrar = pending
    ? "Cobrando…"
    : pedidoWeb
      ? "Cobrar y marcar enviando"
      : esMixto
        ? "Cobrar efectivo y transferencia"
        : listoTerminar
          ? vuelto > 0
            ? `Terminar venta · vuelto ${formatoPesos(vuelto)}`
            : "Terminar venta"
          : `Cobrar ${etiquetaFormaPago(medio?.nombre ?? "Contado")}`;

  return (
    <section className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        {pedidoWeb ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
              Pedido web {pedidoWeb.numero}
            </p>
            <p className="mt-1 text-lg font-black text-amber-950">{pedidoWeb.cliente}</p>
            <p className="text-sm text-amber-950">
              {[pedidoWeb.telefono, pedidoWeb.email].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-amber-900">Dirección</p>
            <p className="text-sm font-semibold text-amber-950">
              {pedidoWeb.direccion?.trim() || "Sin dirección cargada"}
            </p>
            {pedidoWeb.entrega ? (
              <p className="mt-1 text-sm text-amber-950">{pedidoWeb.entrega}</p>
            ) : null}
            <div className="mt-3 rounded-xl bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Para el cadete</p>
              <p className="mt-1 font-bold">{pedidoWeb.pago?.trim() || "El cliente no eligió un método"}</p>
              <p className="text-sm text-neutral-700">
                {pedidoWeb.cliente}
                {pedidoWeb.telefono ? ` · ${pedidoWeb.telefono}` : ""}
              </p>
              <p className="text-sm text-neutral-700">
                {pedidoWeb.direccion?.trim() || "Sin dirección"}
                {pedidoWeb.entrega ? ` · ${pedidoWeb.entrega}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className={`${caja.panel} p-4`}>
            <p className={caja.kicker}>Cliente</p>
            <label className="mt-2 block text-sm font-bold">
              Buscar
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, mail o teléfono"
                className={`${caja.campo} mt-1`}
              />
            </label>
            {busqueda.trim() && (
              <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-neutral-200">
                {clientes.length === 0 && (
                  <li className="px-3 py-2 text-sm">No hay clientes con esa búsqueda.</li>
                )}
                {clientes.map((persona) => (
                  <li key={persona.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-movipack/5"
                      onClick={() => elegir(persona)}
                    >
                      <span className="font-bold">{persona.nombre}</span>
                      <span className="text-neutral-600">
                        {[persona.telefono, persona.email].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-3 block text-sm font-bold">
              Cliente de esta venta
              <input
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setElegido(null);
                  onCliente?.(null);
                }}
                className={`${caja.campo} mt-1 text-lg`}
              />
            </label>
          </div>
        )}

        <div
          className={`rounded-3xl p-5 text-white shadow-lg ${
            listoTerminar ? "bg-emerald-700" : "bg-movipack-deep"
          }`}
        >
          <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-confetti">
            {listoTerminar ? "Listo para terminar" : "Terminal de venta"}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-white/70">A cobrar</p>
              <p className="font-display text-4xl font-bold leading-none">{formatoPesos(total)}</p>
              <p className="mt-1 text-sm text-white/70">{articulos} artículos</p>
            </div>
            {esEfectivo && (
              <>
                <div>
                  <p className="text-xs text-white/70">Paga</p>
                  <p className="font-display text-4xl font-bold leading-none">
                    {entregaNum > 0 ? formatoPesos(entregaNum) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/70">Vuelto</p>
                  <p
                    className={`font-display text-4xl font-bold leading-none ${
                      listoTerminar ? "text-confetti" : "text-white/40"
                    }`}
                  >
                    {listoTerminar ? formatoPesos(vuelto) : formatoPesos(0)}
                  </p>
                </div>
              </>
            )}
            {esMixto && (
              <div className="sm:col-span-2">
                <p className="text-sm text-white/80">
                  {faltaMixto === 0
                    ? "El mixto cierra el total."
                    : `Falta ${formatoPesos(Math.abs(faltaMixto))}${faltaMixto < 0 ? " de más" : ""}.`}
                </p>
              </div>
            )}
          </div>
        </div>

        <ul className={`${caja.panel} max-h-48 overflow-auto`}>
          {lineas.map((linea) => (
            <li
              key={`${linea.codigo}-${linea.nombre}`}
              className="flex justify-between gap-3 border-b border-neutral-100 px-3 py-2 text-sm last:border-0"
            >
              <span>
                <span className="font-black">{linea.cantidad}</span> {linea.nombre}
              </span>
              <span className="font-bold">{formatoPesos(linea.precio * linea.cantidad)}</span>
            </li>
          ))}
        </ul>
        {aviso && (
          <p className="rounded-xl bg-red-100 px-3 py-2 text-sm font-bold text-red-800">{aviso}</p>
        )}
      </div>

      <div className={`${caja.panel} space-y-4 p-4`}>
        {esEfectivo && (
          <div>
            <label className="block text-sm font-bold">
              Con cuánto paga
              <input
                ref={campoEntrega}
                inputMode="numeric"
                value={textoMonto(entrega)}
                onChange={(e) => {
                  setAviso("");
                  setEntrega(digitosMonto(e.target.value));
                }}
                placeholder="$0"
                className={`${caja.campo} mt-1 text-3xl`}
              />
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {TECLAS.map((tecla) => (
                <button
                  key={tecla}
                  type="button"
                  className="min-h-14 rounded-2xl border border-neutral-200 bg-neutral-50 font-display text-2xl font-bold transition hover:border-movipack/40 hover:bg-white"
                  onClick={() => {
                    setAviso("");
                    setEntrega((actual) => {
                      if (tecla === "←") return digitosMonto(actual.slice(0, -1));
                      return digitosMonto(`${actual}${tecla}`);
                    });
                  }}
                >
                  {tecla}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`${caja.boton} mt-2 w-full`}
              onClick={() => {
                setAviso("");
                setEntrega(String(total));
              }}
            >
              Paga justo {formatoPesos(total)}
            </button>
          </div>
        )}

        {esMixto && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Efectivo
              <input
                inputMode="numeric"
                value={textoMonto(efectivoMixto)}
                onChange={(e) => {
                  setAviso("");
                  const siguiente = digitosMonto(e.target.value);
                  setEfectivoMixto(siguiente);
                  const resto = total - (Number(siguiente) || 0);
                  setTransferenciaMixto(resto > 0 ? String(resto) : "");
                }}
                placeholder="$0"
                className={`${caja.campo} mt-1 text-xl`}
              />
            </label>
            <label className="text-sm font-bold">
              Transferencia
              <input
                inputMode="numeric"
                value={textoMonto(transferenciaMixto)}
                onChange={(e) => {
                  setAviso("");
                  setTransferenciaMixto(digitosMonto(e.target.value));
                }}
                placeholder="$0"
                className={`${caja.campo} mt-1 text-xl`}
              />
            </label>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-black">Forma de pago</p>
          <div className="grid grid-cols-2 gap-2">
            {medios.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAviso("");
                  setPago(item.id);
                }}
                className={`min-h-14 rounded-2xl border text-sm font-bold transition ${
                  pago === item.id
                    ? "border-movipack bg-movipack text-white shadow-md shadow-movipack/25"
                    : "border-neutral-200 bg-white hover:border-movipack/40"
                }`}
              >
                {item.nombre}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAviso("");
                setPago("mixto");
              }}
              className={`min-h-14 rounded-2xl border text-sm font-bold transition ${
                esMixto
                  ? "border-movipack bg-movipack text-white shadow-md shadow-movipack/25"
                  : "border-neutral-200 bg-white hover:border-movipack/40"
              }`}
            >
              Efectivo y transferencia
            </button>
          </div>
        </div>

        <button type="button" className={`${caja.boton} w-full`} onClick={() => setVerVentas((v) => !v)}>
          {verVentas ? "Ocultar últimas ventas" : "Últimas ventas"}
        </button>
        {verVentas && (
          <ul className="max-h-48 overflow-auto rounded-xl border border-neutral-200">
            {ventas.length === 0 && (
              <li className="px-3 py-2 text-sm">Hoy todavía no hay ventas cobradas.</li>
            )}
            {ventas.map((venta) => {
              const hora = fechaHoraVenta(venta.creadoEn);
              return (
                <li key={venta.id} className="border-b border-neutral-100 px-3 py-2 text-sm last:border-0">
                  <p className="font-bold">
                    Factura {venta.numero} · {formatoPesos(venta.total)}
                  </p>
                  <p className="text-neutral-600">
                    {hora.hora} · {venta.cliente} · {etiquetaFormaPago(venta.formaPago)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={pending} onClick={onVolver} className={caja.boton}>
            Volver a la venta
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={deuda}
            className="min-h-14 rounded-2xl bg-confetti text-sm font-bold text-neutral-900 disabled:opacity-50"
          >
            Generar deuda{pedidoWeb ? " y enviando" : ""}
          </button>
          <button
            type="button"
            disabled={pending || (esEfectivo && !pagoCubre && entregaNum > 0)}
            onClick={cobrar}
            className={`min-h-16 rounded-2xl text-base font-bold text-white shadow-md transition disabled:opacity-50 sm:col-span-2 ${
              listoTerminar
                ? "bg-emerald-600 shadow-emerald-700/30 hover:bg-emerald-700"
                : "bg-movipack-deep shadow-black/20 hover:bg-black"
            }`}
          >
            {etiquetaCobrar}
          </button>
        </div>
      </div>
    </section>
  );
}
