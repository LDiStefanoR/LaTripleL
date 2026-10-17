"use client";

import { useState } from "react";
import type { VentaCaja } from "@/lib/caja";
import { diaArgentina, etiquetaFormaPago, fechaHoraVenta } from "@/lib/venta-texto";
import { caja } from "@/components/caja-estilo";
import { formatoPesos, nombreVitrina } from "@/lib/format";

export function CajaVentasDia({
  ventas,
  pending,
  onAnular,
  titulo = "Ventas de hoy",
}: {
  ventas: VentaCaja[];
  pending: boolean;
  onAnular: (id: string) => void;
  titulo?: string;
}) {
  const [abierta, setAbierta] = useState<string | null>(ventas[0]?.id ?? null);
  const venta = ventas.find((v) => v.id === abierta) ?? null;

  return (
    <section className="p-4">
      {titulo ? <h2 className={caja.titulo}>{titulo}</h2> : null}
      {ventas.length === 0 ? (
        <p className={`${caja.panel} mt-4 p-4 text-sm`}>
          Todavía no hay ventas cargadas hoy.
        </p>
      ) : (
        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className={`${caja.panel} overflow-x-auto`}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-neutral-100 text-xs uppercase">
                <tr>
                  <th className="px-2 py-2">Factura</th>
                  <th className="px-2 py-2">Día</th>
                  <th className="px-2 py-2">Hora</th>
                  <th className="px-2 py-2">Empleado</th>
                  <th className="px-2 py-2">Cliente</th>
                  <th className="px-2 py-2">Pago</th>
                  <th className="px-2 py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => {
                  const cuando = fechaHoraVenta(v.creadoEn);
                  const activa = v.id === abierta;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setAbierta(v.id)}
                      className={`cursor-pointer border-t border-neutral-200 ${
                        activa ? "bg-movipack/10" : "hover:bg-movipack/5"
                      } ${v.anulada ? "opacity-60" : ""}`}
                    >
                      <td className="px-2 py-2 font-black">
                        {v.numero}
                        {v.anulada ? " · anulada" : ""}
                      </td>
                      <td className="px-2 py-2">{cuando.dia}</td>
                      <td className="px-2 py-2">{cuando.hora}</td>
                      <td className="px-2 py-2">{v.empleado}</td>
                      <td className="px-2 py-2">{v.cliente}</td>
                      <td className="px-2 py-2">{etiquetaFormaPago(v.formaPago)}</td>
                      <td className="px-2 py-2 text-right font-black">{formatoPesos(v.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {venta && <TicketVenta venta={venta} pending={pending} onAnular={onAnular} />}
        </div>
      )}
    </section>
  );
}

function TicketVenta({
  venta,
  pending,
  onAnular,
}: {
  venta: VentaCaja;
  pending: boolean;
  onAnular: (id: string) => void;
}) {
  const cuando = fechaHoraVenta(venta.creadoEn);
  return (
    <article className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200 bg-white font-mono text-sm shadow-sm">
      <p className="bg-movipack-deep py-3 text-center font-display text-lg font-bold italic tracking-wide text-confetti">La Triple L</p>
      <div className="px-4 py-4">
      <p className="text-center text-xs">Garay 1005 · Rosario</p>
      <p className="my-2 text-center text-xs">--------------------------------</p>
      <p className="text-center text-base font-black">Factura {venta.numero}</p>
      {venta.anulada && <p className="text-center font-black text-red-700">ANULADA</p>}
      <p className="mt-2">
        {cuando.dia} {cuando.hora}
      </p>
      <p>Empleado: {venta.empleado}</p>
      <p>Cliente: {venta.cliente}</p>
      <p>Pago: {etiquetaFormaPago(venta.formaPago)}</p>
      <p className="my-2 text-center text-xs">--------------------------------</p>
      <ul>
        {venta.lineas.map((linea) => (
          <li key={`${venta.id}-${linea.productoId}`} className="mb-2">
            <p>
              {linea.cantidad} x {nombreVitrina(linea.nombre)}
            </p>
            <p className="text-right">{formatoPesos(linea.precio * linea.cantidad)}</p>
          </li>
        ))}
      </ul>
      <p className="text-center text-xs">--------------------------------</p>
      <p className="mt-2 text-center text-base font-black">TOTAL {formatoPesos(venta.total)}</p>
      <div className="mt-4 grid gap-2">
        <a
          href={`/caja/comprobante/${venta.id}?formato=a4`}
          className={`${caja.oscuro} px-3 py-2 text-center text-xs`}
        >
          Descargar factura A4
        </a>
        <a
          href={`/caja/comprobante/${venta.id}?formato=ticket`}
          className={`${caja.boton} px-3 py-2 text-center text-xs`}
        >
          Descargar ticket
        </a>
        {!venta.anulada && diaArgentina(new Date(venta.creadoEn)) === diaArgentina() && (
          <button
            type="button"
            disabled={pending}
            className="text-xs font-bold text-red-700 disabled:opacity-50"
            onClick={() => onAnular(venta.id)}
          >
            Anular venta
          </button>
        )}
      </div>
      </div>
    </article>
  );
}
