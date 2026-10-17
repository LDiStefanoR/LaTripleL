"use client";

import { useMemo, useState, useTransition } from "react";
import { devolverVenta } from "@/app/acciones/caja";
import { caja } from "@/components/caja-estilo";
import type { VentaCaja } from "@/lib/caja";
import { formatoPesos } from "@/lib/format";
import { etiquetaFormaPago, fechaHoraVenta } from "@/lib/venta-texto";

type Props = {
  ventas: VentaCaja[];
  onCerrar: () => void;
  onHecho: (mensaje: { ok?: string; error?: string }) => void;
};

type Paso = "lista" | "detalle" | "devolver" | "stock";

function cantidadDevuelta(venta: VentaCaja, productoId: string) {
  return (venta.devoluciones ?? []).reduce((suma, d) => {
    for (const linea of d.lineas) {
      if (linea.productoId === productoId) suma += linea.cantidad;
    }
    return suma;
  }, 0);
}

function estadoVenta(v: VentaCaja) {
  if (v.anulada) return "anulada";
  const hayDev = (v.devoluciones?.length ?? 0) > 0;
  if (!hayDev) return "";
  const parcial = v.lineas.some((l) => cantidadDevuelta(v, l.productoId) < l.cantidad);
  return parcial ? "devolución parcial" : "devuelta";
}

export function CajaUltimasVentas({ ventas, onCerrar, onHecho }: Props) {
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [paso, setPaso] = useState<Paso>("lista");
  const [pending, start] = useTransition();

  const lista = useMemo(
    () =>
      [...ventas]
        .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
        .slice(0, 50),
    [ventas],
  );

  const venta = lista.find((v) => v.id === detalleId) ?? null;

  function abrirDetalle(v: VentaCaja) {
    setDetalleId(v.id);
    setPaso("detalle");
  }

  function entrarDevolver() {
    if (!venta || venta.anulada) return;
    const inicial: Record<string, number> = {};
    for (const linea of venta.lineas) {
      const restante = linea.cantidad - cantidadDevuelta(venta, linea.productoId);
      if (restante > 0) inicial[linea.productoId] = 0;
    }
    if (Object.keys(inicial).length === 0) {
      onHecho({ error: "Ese comprobante ya está completamente devuelto." });
      return;
    }
    setCantidades(inicial);
    setPaso("devolver");
  }

  function volver() {
    if (paso === "stock") {
      setPaso("devolver");
      return;
    }
    if (paso === "devolver") {
      setPaso("detalle");
      return;
    }
    if (paso === "detalle") {
      setDetalleId(null);
      setPaso("lista");
      return;
    }
    onCerrar();
  }

  function confirmarDevolucion(reponerStock: boolean) {
    if (!venta) return;
    const items = Object.entries(cantidades)
      .filter(([, n]) => n > 0)
      .map(([productoId, cantidad]) => ({ productoId, cantidad }));
    if (items.length === 0) {
      onHecho({ error: "Marcá al menos un producto para devolver." });
      return;
    }
    const data = new FormData();
    data.set("ventaId", venta.id);
    data.set("reponerStock", reponerStock ? "1" : "0");
    data.set("items", JSON.stringify(items));
    start(async () => {
      const r = await devolverVenta(data);
      onHecho(r ?? { error: "No se pudo registrar la devolución." });
      if (r?.ok) {
        setPaso("lista");
        setDetalleId(null);
      }
    });
  }

  const titulo =
    paso === "lista"
      ? "↩️ Devoluciones y reimpresiones"
      : paso === "detalle"
        ? `🧾 Factura ${venta?.numero ?? ""}`
        : paso === "devolver"
          ? "↩️ Elegí qué devolver"
          : "📦 ¿Reponer stock?";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-3 pt-8">
      <section className={`${caja.popup} flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden`}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-100 pb-3">
          <div>
            <p className={caja.kicker}>Caja</p>
            <h2 className="font-display text-2xl font-bold">{titulo}</h2>
            {paso === "lista" && (
              <p className="mt-1 text-sm text-neutral-600">
                Tocá un comprobante para ver los productos, reimprimir o hacer una devolución.
              </p>
            )}
          </div>
          <button type="button" className={caja.boton} onClick={volver}>
            {paso === "lista" ? "✕ Cerrar" : "← Volver"}
          </button>
        </div>

        {paso === "lista" && (
          <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
            {lista.length === 0 && (
              <li className="rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-600">
                Todavía no hay comprobantes para mostrar.
              </li>
            )}
            {lista.map((v) => {
              const hora = fechaHoraVenta(v.creadoEn);
              const estado = estadoVenta(v);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => abrirDetalle(v)}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-sm transition hover:border-movipack/50 hover:bg-movipack/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-bold">
                        Factura {v.numero}
                        {estado ? (
                          <span className="ml-2 text-sm font-semibold text-cape">· {estado}</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-neutral-600">
                        {hora.dia} · {hora.hora} · {v.cliente} · {etiquetaFormaPago(v.formaPago)}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {v.lineas.map((l) => `${l.cantidad}× ${l.nombre}`).join(" · ")}
                      </p>
                      <p className="mt-2 text-xs font-bold text-movipack">
                        Tocá para ver ítems →
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-xl font-bold text-movipack">
                      {formatoPesos(v.total)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {paso === "detalle" && venta && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
              <p className="font-bold">
                {venta.cliente} · {etiquetaFormaPago(venta.formaPago)} · {formatoPesos(venta.total)}
              </p>
              <p className="text-neutral-600">
                {fechaHoraVenta(venta.creadoEn).dia} {fechaHoraVenta(venta.creadoEn).hora}
                {estadoVenta(venta) ? ` · ${estadoVenta(venta)}` : ""}
              </p>
            </div>

            <ul className="min-h-0 flex-1 space-y-1.5 overflow-auto">
              {venta.lineas.map((linea) => {
                const ya = cantidadDevuelta(venta, linea.productoId);
                return (
                  <li
                    key={linea.productoId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold">{linea.nombre}</p>
                      <p className="text-xs text-neutral-500">
                        Cód. {linea.codigo}
                        {ya > 0 ? ` · ya devueltas ${ya} de ${linea.cantidad}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold">
                        {linea.cantidad} × {formatoPesos(linea.precio)}
                      </p>
                      <p className="text-sm text-movipack">
                        {formatoPesos(linea.cantidad * linea.precio)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="grid shrink-0 gap-2 border-t border-neutral-100 pt-3 sm:grid-cols-3">
              <a
                href={`/caja/comprobante/${venta.id}?formato=a4`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${caja.boton} flex h-12 items-center justify-center gap-1`}
              >
                📄 Reimprimir PDF
              </a>
              <a
                href={`/caja/comprobante/${venta.id}?formato=ticket`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${caja.boton} flex h-12 items-center justify-center gap-1`}
              >
                🎟️ Reimprimir ticket
              </a>
              {!venta.anulada ? (
                <button
                  type="button"
                  className={`${caja.primario} flex h-12 items-center justify-center gap-1`}
                  onClick={entrarDevolver}
                >
                  ↩️ Hacer devolución
                </button>
              ) : (
                <p className="flex h-12 items-center justify-center text-sm font-semibold text-neutral-500">
                  Comprobante anulado
                </p>
              )}
            </div>
          </div>
        )}

        {paso === "devolver" && venta && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <p className="shrink-0 text-sm font-semibold text-neutral-700">
              Factura {venta.numero} · {venta.cliente}. Marcá cantidades (parcial o total).
            </p>
            <ul className="min-h-0 flex-1 space-y-2 overflow-auto">
              {venta.lineas.map((linea) => {
                const ya = cantidadDevuelta(venta, linea.productoId);
                const max = linea.cantidad - ya;
                if (max < 1) {
                  return (
                    <li
                      key={linea.productoId}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500"
                    >
                      {linea.nombre} · ya devolviste las {linea.cantidad} unidades
                    </li>
                  );
                }
                const valor = cantidades[linea.productoId] ?? 0;
                return (
                  <li
                    key={linea.productoId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{linea.nombre}</p>
                      <p className="text-xs text-neutral-500">
                        Cód. {linea.codigo} · vendidas {linea.cantidad}
                        {ya > 0 ? ` · ya devueltas ${ya}` : ""} · quedan {max}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="h-9 w-9 rounded-lg border border-neutral-200 font-bold"
                        onClick={() =>
                          setCantidades((prev) => ({
                            ...prev,
                            [linea.productoId]: Math.max(0, (prev[linea.productoId] ?? 0) - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-black">{valor}</span>
                      <button
                        type="button"
                        className="h-9 w-9 rounded-lg border border-neutral-200 font-bold"
                        onClick={() =>
                          setCantidades((prev) => ({
                            ...prev,
                            [linea.productoId]: Math.min(max, (prev[linea.productoId] ?? 0) + 1),
                          }))
                        }
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className={`${caja.boton} ml-1`}
                        onClick={() =>
                          setCantidades((prev) => ({ ...prev, [linea.productoId]: max }))
                        }
                      >
                        Todo
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-neutral-100 pt-3">
              <button
                type="button"
                className={caja.boton}
                onClick={() => {
                  const todo: Record<string, number> = {};
                  for (const linea of venta.lineas) {
                    const max = linea.cantidad - cantidadDevuelta(venta, linea.productoId);
                    if (max > 0) todo[linea.productoId] = max;
                  }
                  setCantidades(todo);
                }}
              >
                ✅ Devolver todo el comprobante
              </button>
              <button
                type="button"
                disabled={pending}
                className={caja.primario}
                onClick={() => {
                  const hay = Object.values(cantidades).some((n) => n > 0);
                  if (!hay) {
                    onHecho({ error: "Marcá al menos un producto para devolver." });
                    return;
                  }
                  setPaso("stock");
                }}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {paso === "stock" && venta && (
          <div className="mt-6 space-y-4">
            <p className="text-base font-semibold text-neutral-800">
              ¿Querés reponer estos productos en el stock, o tramitar la devolución sin modificar el
              inventario?
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={pending}
                className="min-h-24 rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-left"
                onClick={() => confirmarDevolucion(true)}
              >
                <span className="block text-2xl">📦</span>
                <span className="mt-1 block font-display text-lg font-bold text-emerald-900">
                  Reponer stock
                </span>
                <span className="text-sm text-emerald-800">
                  Suma otra vez las unidades al inventario.
                </span>
              </button>
              <button
                type="button"
                disabled={pending}
                className="min-h-24 rounded-2xl border-2 border-neutral-300 bg-white px-4 py-3 text-left"
                onClick={() => confirmarDevolucion(false)}
              >
                <span className="block text-2xl">🧾</span>
                <span className="mt-1 block font-display text-lg font-bold text-neutral-900">
                  Sin tocar stock
                </span>
                <span className="text-sm text-neutral-600">
                  Solo registra la devolución del comprobante.
                </span>
              </button>
            </div>
            {pending && <p className="text-sm font-bold text-neutral-600">Guardando devolución…</p>}
          </div>
        )}
      </section>
    </div>
  );
}
