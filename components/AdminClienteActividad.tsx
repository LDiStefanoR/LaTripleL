"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adminAgregarTicket,
  adminGuardarTicket,
  adminMarcarDeudaTotal,
  adminMarcarTicketPagado,
  adminPagoParcial,
  type EstadoCuentaAdmin,
} from "@/app/acciones/cuenta-admin";
import { formatoFecha, formatoPesos } from "@/lib/format";
import {
  ETIQUETA_COBRO,
  estadoCobroTicket,
  interesDeTicket,
  interesTotalDeuda,
  numeroVisibleTicket,
  semaforoDeuda,
  vencimientoDeTicket,
} from "@/lib/deuda";
import { whatsappUrl } from "@/lib/whatsapp";
import type { ResumenCliente, TicketDeuda } from "@/types/cuenta";

const campo =
  "rounded-lg border border-movipack/20 px-2.5 py-2 text-sm outline-none focus:border-movipack";
const btn =
  "rounded-lg border border-movipack/30 px-3 py-2 text-xs font-bold text-movipack disabled:opacity-60";
const btnFuerte =
  "rounded-lg bg-cape px-3 py-2 text-xs font-bold text-white disabled:opacity-60";

const TONO = {
  verde: "bg-emerald-600 text-white",
  amarillo: "bg-amber-400 text-neutral-900",
  rojo: "bg-cape text-white",
} as const;

function fechaMasDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function AdminClienteActividad({ resumen }: { resumen: ResumenCliente }) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoCuentaAdmin>(null);
  const [pending, start] = useTransition();
  const [cobro, setCobro] = useState<"debe" | "parcial" | "pagado">("debe");
  const [totalNuevo, setTotalNuevo] = useState("");
  const [pagoNuevo, setPagoNuevo] = useState("");

  const semaforo = semaforoDeuda(resumen.ticketsVigentes);
  const capital = resumen.saldoTotal;
  const mora = interesTotalDeuda(resumen.ticketsVigentes);
  const actividad = useMemo(() => {
    return [...resumen.ticketsVigentes, ...resumen.ticketsPagados].sort((a, b) =>
      b.fecha.localeCompare(a.fecha),
    );
  }, [resumen]);

  const totalNum = Number(totalNuevo.replace(/\./g, "").replace(",", ".")) || 0;
  const pagoNum = Number(pagoNuevo.replace(/\./g, "").replace(",", ".")) || 0;
  const quedaNuevo =
    cobro === "pagado"
      ? 0
      : cobro === "parcial"
        ? Math.max(0, totalNum - pagoNum)
        : totalNum;

  function run(tarea: () => Promise<EstadoCuentaAdmin>, form?: HTMLFormElement) {
    setMensaje(null);
    start(async () => {
      const resultado = await tarea();
      setMensaje(resultado);
      if (resultado?.ok) {
        form?.reset();
        setCobro("debe");
        setTotalNuevo("");
        setPagoNuevo("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/cuentas" className="text-sm font-bold text-movipack underline">
        ← Todos los clientes
      </Link>

      <section className={`rounded-3xl p-5 shadow-sm ${TONO[semaforo]}`}>
        <p className="text-sm font-semibold opacity-80">Perfil</p>
        <h2 className="mt-1 font-display text-3xl font-bold italic">
          {resumen.cliente.nombre}
        </h2>
        <p className="mt-1 text-sm opacity-90">
          {resumen.cliente.telefono}
          {resumen.cliente.email ? ` · ${resumen.cliente.email}` : ""}
        </p>
        <p className="mt-3 font-display text-4xl font-bold italic">
          {formatoPesos(capital)}
        </p>
        {mora > 0 && (
          <p className="mt-1 text-sm font-bold">
            Intereses por mora {formatoPesos(mora)} · total{" "}
            {formatoPesos(capital + mora)}
          </p>
        )}
        <p className="text-sm font-semibold">
          {semaforo === "rojo"
            ? "Mora (10% o más)"
            : semaforo === "amarillo"
              ? "Primer recargo (5%)"
              : capital > 0
                ? "Al día, dentro del plazo"
                : "Sin deuda"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {capital > 0 && (
            <button
              type="button"
              disabled={pending}
              className="rounded-lg bg-white/20 px-3 py-2 text-xs font-bold"
              onClick={() => {
                const data = new FormData();
                data.set("clienteId", resumen.cliente.id);
                run(() => adminMarcarDeudaTotal(data));
              }}
            >
              Marcar deuda total pagada
            </button>
          )}
          <a
            href={whatsappUrl(
              `Hola ${resumen.cliente.nombre}, te escribimos de La Triple L por tu cuenta.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white/20 px-3 py-2 text-xs font-bold"
          >
            WhatsApp
          </a>
        </div>
      </section>

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

      <section className="rounded-2xl border border-movipack/15 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-movipack-deep">Cargar ticket</p>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            run(() => adminAgregarTicket(new FormData(form)), form);
          }}
        >
          <input type="hidden" name="clienteId" value={resumen.cliente.id} />
          <input name="numero" placeholder="N° ticket" className={`${campo} w-28`} />
          <input
            name="descripcion"
            placeholder="Concepto"
            className={`${campo} min-w-40 flex-1`}
          />
          <input
            name="total"
            required
            placeholder="Importe"
            value={totalNuevo}
            onChange={(e) => setTotalNuevo(e.target.value)}
            className={`${campo} w-28`}
          />
          <label className="text-[11px] font-bold text-neutral-500">
            Vencimiento
            <input
              name="vencimiento"
              type="date"
              defaultValue={fechaMasDias(7)}
              className={`${campo} mt-0.5 w-40`}
            />
          </label>
          <select
            name="cobro"
            className={`${campo} w-36`}
            value={cobro}
            onChange={(e) => setCobro(e.target.value as typeof cobro)}
          >
            <option value="debe">A cuenta (debe)</option>
            <option value="parcial">Pago parcial</option>
            <option value="pagado">Pagado</option>
          </select>
          {cobro !== "debe" && (
            <select name="medioPago" className={`${campo} w-40`} defaultValue="local">
              <option value="local">En el local</option>
              <option value="transferencia">Transferencia</option>
            </select>
          )}
          {cobro === "debe" && <input type="hidden" name="medioPago" value="cuenta" />}
          {cobro === "parcial" && (
            <input
              name="pagado"
              placeholder="Pagó"
              value={pagoNuevo}
              onChange={(e) => setPagoNuevo(e.target.value)}
              className={`${campo} w-24`}
            />
          )}
          <label className="text-[11px] font-bold text-neutral-500">
            Factura
            <input
              name="adjunto"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="mt-0.5 block w-44 text-xs"
            />
          </label>
          <button type="submit" disabled={pending} className={btnFuerte}>
            Cargar
          </button>
        </form>
        {cobro === "parcial" && totalNum > 0 && (
          <p className="mt-2 text-xs font-semibold text-neutral-600">
            Queda debiendo {formatoPesos(quedaNuevo)}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-movipack/15 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-movipack-deep">Actividad</p>
        <ul className="mt-3 space-y-2">
          {actividad.length === 0 && (
            <li className="text-sm text-neutral-500">Todavía no hay movimientos.</li>
          )}
          {actividad.map((ticket) => (
            <FilaTicket
              key={ticket.id}
              ticket={ticket}
              clienteId={resumen.cliente.id}
              pending={pending}
              onSave={(data) => run(() => adminGuardarTicket(data))}
              onPagar={() => {
                const data = new FormData();
                data.set("ticketId", ticket.id);
                run(() => adminMarcarTicketPagado(data));
              }}
              onParcial={(data) => run(() => adminPagoParcial(data))}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function FilaTicket({
  ticket,
  clienteId,
  pending,
  onSave,
  onPagar,
  onParcial,
}: {
  ticket: TicketDeuda;
  clienteId: string;
  pending: boolean;
  onSave: (data: FormData) => void;
  onPagar: () => void;
  onParcial: (data: FormData) => void;
}) {
  const [extra, setExtra] = useState<"pago" | "interes" | null>(null);
  const cobro = estadoCobroTicket(ticket);
  const vto = vencimientoDeTicket(ticket);
  const mora = interesDeTicket(ticket);
  return (
    <li className="rounded-xl border border-neutral-100 p-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(new FormData(e.currentTarget));
        }}
      >
        <input type="hidden" name="ticketId" value={ticket.id} />
        <label className="text-[11px] font-bold text-neutral-500">
          N°
          <input
            name="numero"
            defaultValue={numeroVisibleTicket(ticket)}
            className={`${campo} mt-0.5 w-28`}
          />
        </label>
        <label className="min-w-40 flex-1 text-[11px] font-bold text-neutral-500">
          Concepto
          <input
            name="descripcion"
            defaultValue={ticket.descripcion}
            className={`${campo} mt-0.5 w-full`}
          />
        </label>
        <label className="text-[11px] font-bold text-neutral-500">
          Importe
          <input
            name="total"
            defaultValue={ticket.total}
            className={`${campo} mt-0.5 w-24`}
          />
        </label>
        <label className="text-[11px] font-bold text-neutral-500">
          Queda
          <input
            name="debe"
            defaultValue={ticket.debe}
            className={`${campo} mt-0.5 w-24`}
          />
        </label>
        <label className="text-[11px] font-bold text-neutral-500">
          Vence
          <input
            name="vencimiento"
            type="date"
            defaultValue={vto}
            className={`${campo} mt-0.5 w-36`}
          />
        </label>
        <button type="submit" disabled={pending} className={btn}>
          Guardar
        </button>
      </form>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        <span>
          {formatoFecha(ticket.fecha)} · {ETIQUETA_COBRO[cobro]}
        </span>
        {ticket.debe > 0 && mora.interes > 0 && (
          <span className="font-semibold text-cape">
            + {formatoPesos(mora.interes)} mora ({Math.round(mora.tasa * 100)}%)
          </span>
        )}
        {ticket.adjunto ? (
          <a
            href={ticket.adjunto}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-movipack underline"
          >
            Descargar factura
          </a>
        ) : (
          <span>Sin factura</span>
        )}
        {ticket.debe > 0 && (
          <>
            <button
              type="button"
              className="font-bold text-movipack underline"
              onClick={() => setExtra(extra === "pago" ? null : "pago")}
            >
              Pago parcial
            </button>
            <button
              type="button"
              disabled={pending}
              className="font-bold text-cape underline"
              onClick={onPagar}
            >
              Abonar
            </button>
          </>
        )}
        <button
          type="button"
          className="font-bold text-neutral-400 underline"
          onClick={() => setExtra(extra === "interes" ? null : "interes")}
        >
          Interés
        </button>
      </div>

      {extra === "pago" && ticket.debe > 0 && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-neutral-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            onParcial(new FormData(form));
            form.reset();
          }}
        >
          <input type="hidden" name="clienteId" value={clienteId} />
          <input type="hidden" name="ticketId" value={ticket.id} />
          <p className="w-full text-xs text-neutral-600">
            Queda {formatoPesos(ticket.debe)} de este ticket.
          </p>
          <input
            name="monto"
            required
            placeholder="Monto de este pago"
            className={`${campo} w-36`}
          />
          <select name="medio" className={`${campo} w-40`} defaultValue="local">
            <option value="local">En el local</option>
            <option value="transferencia">Transferencia</option>
          </select>
          <button type="submit" disabled={pending} className={btnFuerte}>
            Registrar pago
          </button>
        </form>
      )}

      {extra === "interes" && (
        <form
          className="mt-3 space-y-2 rounded-lg bg-neutral-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(new FormData(e.currentTarget));
          }}
        >
          <input type="hidden" name="ticketId" value={ticket.id} />
          <p className="text-xs text-neutral-600">
            Automático: 5% / 10% / 20% / 40% según las semanas de mora. Hoy
            calcularía {formatoPesos(mora.automatico)}
            {mora.semanas > 0 ? ` (${Math.round((mora.tasa || 0) * 100)}%).` : "."}
          </p>
          <label className="block text-[11px] font-bold text-neutral-500">
            Interés de este comprobante
            <select
              name="interesDesactivado"
              defaultValue={ticket.interesDesactivado ? "1" : "0"}
              className={`${campo} mt-0.5 w-56`}
            >
              <option value="0">Automático (5 / 10 / 20 / 40%)</option>
              <option value="1">Desactivado</option>
            </select>
          </label>
          <input type="hidden" name="interesAuto" value="1" />
          <label className="block text-[11px] font-bold text-neutral-500">
            O un monto fijo de interés
            <input
              name="interesManual"
              defaultValue={
                typeof ticket.interesManual === "number" ? ticket.interesManual : ""
              }
              placeholder={String(mora.automatico || "")}
              className={`${campo} mt-0.5 w-32`}
            />
          </label>
          <label className="block text-[11px] font-bold text-neutral-500">
            Reemplazar factura
            <input
              name="adjunto"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="mt-0.5 block text-xs"
            />
          </label>
          <button type="submit" disabled={pending} className={btn}>
            Guardar interés
          </button>
        </form>
      )}
    </li>
  );
}
