"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adminAtenderSolicitud,
  adminMarcarNovedadesLeidas,
  type EstadoCuentaAdmin,
} from "@/app/acciones/cuenta-admin";
import { formatoPesos } from "@/lib/format";
import { semaforoDeuda } from "@/lib/deuda";
import type { NovedadAdmin, ResumenCliente, SolicitudCuenta } from "@/types/cuenta";

const TONO = {
  verde: "border-emerald-300 bg-emerald-50/80",
  amarillo: "border-amber-300 bg-amber-50",
  rojo: "border-red-300 bg-red-50",
} as const;

const PUNTO = {
  verde: "bg-emerald-500",
  amarillo: "bg-amber-400",
  rojo: "bg-red-500",
} as const;

const LEYENDA = {
  verde: "Al día",
  amarillo: "Recargo 5%",
  rojo: "Mora",
} as const;

export function AdminCuentasLista({
  resumenes,
  novedades,
  solicitudes,
}: {
  resumenes: ResumenCliente[];
  novedades: NovedadAdmin[];
  solicitudes: SolicitudCuenta[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [soloDeuda, setSoloDeuda] = useState(true);
  const [mensaje, setMensaje] = useState<EstadoCuentaAdmin>(null);
  const [pending, start] = useTransition();

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const tel = t.replace(/\D/g, "");
    return resumenes.filter((r) => {
      if (soloDeuda && r.saldoTotal <= 0) return false;
      if (!t) return true;
      const telCli = r.cliente.telefono.replace(/\D/g, "");
      return (
        r.cliente.nombre.toLowerCase().includes(t) ||
        r.cliente.email.toLowerCase().includes(t) ||
        (tel && telCli.includes(tel))
      );
    });
  }, [q, resumenes, soloDeuda]);

  const pendientes = novedades.filter((n) => !n.leida);
  const solicitudesPendientes = solicitudes.filter((s) => s.estado === "pendiente");
  const nombreDe = (id?: string) =>
    resumenes.find((r) => r.cliente.id === id)?.cliente.nombre ?? "Cliente";

  function run(tarea: () => Promise<EstadoCuentaAdmin>) {
    setMensaje(null);
    start(async () => {
      const resultado = await tarea();
      setMensaje(resultado);
      if (resultado?.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
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

      {(pendientes.length > 0 || solicitudesPendientes.length > 0) && (
        <section className="rounded-2xl border border-cape/20 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-cape">Avisos</h2>
            {pendientes.length > 0 && (
              <button
                type="button"
                disabled={pending}
                className="text-xs font-bold text-movipack underline"
                onClick={() => run(() => adminMarcarNovedadesLeidas())}
              >
                Marcar vistos
              </button>
            )}
          </div>
          <ul className="mt-2 space-y-2 text-sm">
            {pendientes.slice(0, 4).map((n) => (
              <li key={n.id}>
                <span className="font-bold">{n.titulo}</span>
                <span className="text-neutral-600"> · {n.detalle}</span>
              </li>
            ))}
            {solicitudesPendientes.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  {s.tipo === "pago" ? "Aviso de pago" : "Pedido de efectivo"} ·{" "}
                  {nombreDe(s.clienteId)} · {formatoPesos(s.monto)}
                </span>
                {s.tipo === "pago" && (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-lg bg-cape px-3 py-1 text-xs font-bold text-white"
                    onClick={() => {
                      const data = new FormData();
                      data.set("solicitudId", s.id);
                      data.set("estado", "atendida");
                      data.set("imputar", "1");
                      data.set("clienteId", s.clienteId);
                      data.set("monto", String(s.monto));
                      run(() => adminAtenderSolicitud(data));
                    }}
                  >
                    Confirmar pago
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-xs font-bold text-neutral-600">
          Buscar cliente
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, mail o teléfono"
            className="mt-1 w-full rounded-lg border border-movipack/20 px-3 py-2 text-sm outline-none focus:border-movipack"
          />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-movipack/20 bg-white px-3 py-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={soloDeuda}
            onChange={(e) => setSoloDeuda(e.target.checked)}
          />
          Solo quienes deben
        </label>
      </div>
      <p className="text-sm text-neutral-500">
        {filtrados.length} cliente{filtrados.length === 1 ? "" : "s"}
      </p>

      <ul className="space-y-2">
        {filtrados.length === 0 && (
          <li className="rounded-2xl bg-white p-4 text-sm text-neutral-600 shadow-sm">
            No hay clientes con ese filtro.
          </li>
        )}
        {filtrados.map((r) => {
          const semaforo = semaforoDeuda(r.ticketsVigentes);
          return (
            <li key={r.cliente.id}>
              <Link
                href={`/admin/cuentas/${r.cliente.id}`}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm ${TONO[semaforo]}`}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold text-movipack-deep">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${PUNTO[semaforo]}`}
                    />
                    {r.cliente.nombre}
                  </p>
                  <p className="truncate text-sm text-neutral-600">
                    {LEYENDA[semaforo]}
                    {r.cliente.telefono ? ` · ${r.cliente.telefono}` : ""}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-lg font-bold ${
                    r.saldoTotal > 0 ? "text-cape" : "text-emerald-700"
                  }`}
                >
                  {formatoPesos(r.saldoTotal)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
