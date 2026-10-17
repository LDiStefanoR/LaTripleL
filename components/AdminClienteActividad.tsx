"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adminAgregarTicket,
  adminBorrarTicket,
  adminGuardarTicket,
  adminMarcarDeudaTotal,
  adminMarcarTicketPagado,
  adminPagoParcial,
  type EstadoCuentaAdmin,
} from "@/app/acciones/cuenta-admin";
import { formatoFecha, formatoPesos, digitosMonto, textoMonto } from "@/lib/format";
import {
  ETIQUETA_COBRO,
  estadoCobroTicket,
  interesDeTicket,
  interesTotalDeuda,
  numeroVisibleTicket,
  semaforoDeuda,
  vencimientoDeTicket,
} from "@/lib/deuda";
import { politicaDeCliente } from "@/lib/politica-cliente";
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

export function AdminClienteActividad({
  resumen,
  moraCredito,
  moraCuenta,
  onVolver,
}: {
  resumen: ResumenCliente;
  moraCredito?: number[];
  moraCuenta?: number[];
  onVolver?: () => void;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoCuentaAdmin>(null);
  const [pending, start] = useTransition();
  const [cobro, setCobro] = useState<"debe" | "parcial" | "pagado">("debe");
  const [totalNuevo, setTotalNuevo] = useState("");
  const [pagoNuevo, setPagoNuevo] = useState("");

  const politica = politicaDeCliente(resumen.cliente, { moraCredito, moraCuenta });
  const semaforo = semaforoDeuda(resumen.ticketsVigentes);
  const capital = resumen.saldoTotal;
  const mora = interesTotalDeuda(resumen.ticketsVigentes, politica);
  const actividad = useMemo(() => {
    return [...resumen.ticketsVigentes, ...resumen.ticketsPagados].sort((a, b) =>
      b.fecha.localeCompare(a.fecha),
    );
  }, [resumen]);

  const totalNum = Number(digitosMonto(totalNuevo)) || 0;
  const pagoNum = Number(digitosMonto(pagoNuevo)) || 0;
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
      {onVolver ? (
        <button type="button" onClick={onVolver} className="text-sm font-bold text-movipack underline">
          ← Todos los clientes
        </button>
      ) : (
        <Link href="/caja" className="text-sm font-bold text-movipack underline">
          ← Volver a la caja
        </Link>
      )}

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
          <input
            name="descripcion"
            placeholder="Concepto"
            className={`${campo} min-w-40 flex-1`}
          />
          <input
            name="total"
            required
            placeholder="Importe"
            inputMode="numeric"
            value={textoMonto(totalNuevo)}
            onChange={(e) => setTotalNuevo(digitosMonto(e.target.value))}
            className={`${campo} w-32`}
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
              inputMode="numeric"
              value={textoMonto(pagoNuevo)}
              onChange={(e) => setPagoNuevo(digitosMonto(e.target.value))}
              className={`${campo} w-28`}
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

      <Actividad
        actividad={actividad}
        politica={politica}
        clienteId={resumen.cliente.id}
        pending={pending}
        onSave={(data) => run(() => adminGuardarTicket(data))}
        onPagar={(ticketId) => {
          const data = new FormData();
          data.set("ticketId", ticketId);
          run(() => adminMarcarTicketPagado(data));
        }}
        onParcial={(data) => run(() => adminPagoParcial(data))}
        onBorrar={(ticketId) => {
          const data = new FormData();
          data.set("ticketId", ticketId);
          run(() => adminBorrarTicket(data));
        }}
      />
    </div>
  );
}

const ESTADO_FILA = {
  impago: { texto: "Impago", clase: "bg-red-100 text-cape" },
  parcial: { texto: "Parcial", clase: "bg-amber-100 text-amber-900" },
  abonado: { texto: "Pagado", clase: "bg-emerald-100 text-emerald-800" },
} as const;

function Actividad({
  actividad,
  politica,
  clienteId,
  pending,
  onSave,
  onPagar,
  onParcial,
  onBorrar,
}: {
  actividad: TicketDeuda[];
  politica: { moraModo?: "escala" | "fijo" | "sin"; moraPorcentaje?: number };
  clienteId: string;
  pending: boolean;
  onSave: (data: FormData) => void;
  onPagar: (ticketId: string) => void;
  onParcial: (data: FormData) => void;
  onBorrar: (ticketId: string) => void;
}) {
  const [vista, setVista] = useState<"todos" | "impagos" | "pagados">("todos");
  const [q, setQ] = useState("");
  const visibles = actividad.filter((ticket) => {
    const cobro = estadoCobroTicket(ticket);
    if (vista === "impagos" && cobro === "abonado") return false;
    if (vista === "pagados" && cobro !== "abonado") return false;
    const busqueda = q.trim().toLowerCase();
    if (!busqueda) return true;
    return numeroVisibleTicket(ticket).toLowerCase().includes(busqueda);
  });

  return (
    <section className="rounded-2xl border border-movipack/15 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm font-bold text-movipack-deep">Comprobantes</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Número"
          className={`${campo} w-32`}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["todos", "Todos"],
            ["impagos", "Impagos"],
            ["pagados", "Pagados"],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            onClick={() => setVista(id)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${vista === id ? "bg-movipack text-white" : "bg-neutral-100 text-neutral-700"}`}
          >
            {texto}
          </button>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-neutral-100">
        {visibles.length === 0 && (
          <li className="py-4 text-sm text-neutral-500">No hay comprobantes con ese filtro.</li>
        )}
        {visibles.map((ticket) => (
          <FilaTicket
            key={ticket.id}
            ticket={ticket}
            politica={politica}
            clienteId={clienteId}
            pending={pending}
            onSave={onSave}
            onPagar={() => onPagar(ticket.id)}
            onParcial={onParcial}
            onBorrar={() => onBorrar(ticket.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function Popup({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-3 pt-8"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl font-bold">{titulo}</h3>
          <button type="button" onClick={onCerrar} className={btn}>
            Cerrar
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function FilaTicket({
  ticket,
  politica,
  clienteId,
  pending,
  onSave,
  onPagar,
  onParcial,
  onBorrar,
}: {
  ticket: TicketDeuda;
  politica: { moraModo?: "escala" | "fijo" | "sin"; moraPorcentaje?: number };
  clienteId: string;
  pending: boolean;
  onSave: (data: FormData) => void;
  onPagar: () => void;
  onParcial: (data: FormData) => void;
  onBorrar: () => void;
}) {
  const [detalle, setDetalle] = useState(false);
  const [pago, setPago] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [importe, setImporte] = useState(String(ticket.total || ""));
  const [queda, setQueda] = useState(String(ticket.debe || ""));
  const cobro = estadoCobroTicket(ticket);
  const estado = ESTADO_FILA[cobro];
  const vto = vencimientoDeTicket(ticket);
  const mora = interesDeTicket(ticket, undefined, politica);
  const pagado = Math.max(0, (Number(importe) || 0) - (Number(queda) || 0));
  const aCobrar = (Number(queda) || 0) + (ticket.debe > 0 ? mora.interes : 0);

  useEffect(() => {
    setImporte(String(ticket.total || ""));
    setQueda(String(ticket.debe || ""));
  }, [ticket.total, ticket.debe]);

  return (
    <li className="flex items-center gap-3 py-2">
      <p className="min-w-0 flex-1 font-bold">Comprobante {numeroVisibleTicket(ticket)}</p>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${estado.clase}`}>
        {estado.texto}
      </span>
      <button type="button" className={btn} onClick={() => setDetalle(true)}>
        Ver detalle
      </button>
      {detalle && (
        <Popup titulo={`Comprobante ${numeroVisibleTicket(ticket)}`} onCerrar={() => setDetalle(false)}>
          <p className="text-xs font-semibold text-neutral-500">
            {formatoFecha(ticket.fecha)} · {ETIQUETA_COBRO[cobro]}
          </p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(new FormData(e.currentTarget));
        }}
      >
        <input type="hidden" name="ticketId" value={ticket.id} />
        <label className="block text-[11px] font-bold text-neutral-500">
          Concepto
          <input
            name="descripcion"
            defaultValue={ticket.descripcion}
            className={`${campo} mt-0.5 w-full`}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] font-bold text-neutral-500">
            Importe
            <input
              name="total"
              inputMode="numeric"
              value={textoMonto(importe)}
              onChange={(e) => setImporte(digitosMonto(e.target.value))}
              className={`${campo} mt-0.5 w-full`}
            />
          </label>
          <p className="text-[11px] font-bold text-neutral-500">
            Pagado
            <span className="mt-0.5 block rounded-lg bg-neutral-50 px-2.5 py-2 text-sm font-semibold text-neutral-800">
              {formatoPesos(pagado)}
            </span>
          </p>
          <label className="text-[11px] font-bold text-neutral-500">
            Queda
            <input
              name="debe"
              inputMode="numeric"
              value={textoMonto(queda)}
              onChange={(e) => setQueda(digitosMonto(e.target.value))}
              className={`${campo} mt-0.5 w-full`}
            />
          </label>
          <label className="text-[11px] font-bold text-neutral-500">
            Vence
            <input
              name="vencimiento"
              type="date"
              defaultValue={vto}
              className={`${campo} mt-0.5 w-full`}
            />
          </label>
        </div>
        {(ticket.lineas ?? []).length > 0 && (
          <ul className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
            {ticket.lineas.map((linea, indice) => (
              <li key={`${linea.codigo}-${indice}`} className="flex justify-between gap-3 py-1">
                <span>
                  {linea.codigo ? `${linea.codigo} · ` : ""}
                  {linea.nombre}
                </span>
                <span className="font-semibold">{formatoPesos(linea.monto ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-semibold text-neutral-700">
            Mora {formatoPesos(ticket.debe > 0 ? mora.interes : 0)}
            {ticket.debe > 0 && mora.interes > 0 ? ` (${Math.round(mora.tasa * 100)}%)` : ""}
            {" · "}a cobrar {formatoPesos(aCobrar)}
          </p>
          <button type="submit" disabled={pending} className={btn}>
            Guardar importes
          </button>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        <a
          href={`/caja/deuda/${ticket.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-movipack underline"
        >
          Imprimir factura
        </a>
        {ticket.adjunto ? (
          <a
            href={ticket.adjunto}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-movipack underline"
          >
            Archivo adjunto
          </a>
        ) : null}
        {ticket.debe > 0 && (
          <>
            <button
              type="button"
              className={btn}
              onClick={() => setPago(true)}
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
        {confirmarBorrado ? (
          <button
            type="button"
            disabled={pending}
            className="font-bold text-cape underline"
            onClick={onBorrar}
          >
            Confirmar borrado
          </button>
        ) : (
          <button
            type="button"
            className="font-bold text-cape underline"
            onClick={() => setConfirmarBorrado(true)}
          >
            Borrar deuda
          </button>
        )}
      </div>
      <form
        className="mt-4 space-y-2 border-t border-neutral-100 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(new FormData(e.currentTarget));
        }}
      >
        <input type="hidden" name="ticketId" value={ticket.id} />
        <p className="text-xs text-neutral-600">
          Mora automática: hoy calcularía {formatoPesos(mora.automatico)}
          {mora.semanas > 0 ? ` (${Math.round((mora.tasa || 0) * 100)}%).` : "."}
        </p>
        <label className="block text-[11px] font-bold text-neutral-500">
          Interés de este comprobante
          <select
            name="interesDesactivado"
            defaultValue={ticket.interesDesactivado ? "1" : "0"}
            className={`${campo} mt-0.5 w-full`}
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
            defaultValue={typeof ticket.interesManual === "number" ? ticket.interesManual : ""}
            placeholder={String(mora.automatico || "")}
            className={`${campo} mt-0.5 w-32`}
          />
        </label>
        <button type="submit" disabled={pending} className={btn}>
          Guardar interés
        </button>
      </form>
        </Popup>
      )}
      {pago && ticket.debe > 0 && (
        <Popup titulo={`Pago parcial · ${numeroVisibleTicket(ticket)}`} onCerrar={() => setPago(false)}>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              onParcial(new FormData(form));
              setPago(false);
            }}
          >
            <input type="hidden" name="clienteId" value={clienteId} />
            <input type="hidden" name="ticketId" value={ticket.id} />
            <p className="w-full text-sm text-neutral-600">
              Queda {formatoPesos(ticket.debe)} de este comprobante.
            </p>
            <label className="text-[11px] font-bold text-neutral-500">
              Monto
              <input name="monto" required placeholder="$0" className={`${campo} mt-0.5 w-36`} />
            </label>
            <label className="text-[11px] font-bold text-neutral-500">
              Medio
              <select name="medio" className={`${campo} mt-0.5 w-40`} defaultValue="local">
                <option value="local">En el local</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </label>
            <button type="submit" disabled={pending} className={btnFuerte}>
              Imputar pago
            </button>
          </form>
        </Popup>
      )}
    </li>
  );
}
