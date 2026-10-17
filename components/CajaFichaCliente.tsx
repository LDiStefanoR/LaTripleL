"use client";

import { useState, useTransition } from "react";
import { actualizarClienteCaja } from "@/app/acciones/deposito";
import { CondicionesCliente } from "@/components/CamposCredito";
import { caja } from "@/components/caja-estilo";
import type { CompraCaja, DeudaCaja, PersonaCaja } from "@/components/CajaDeposito";
import { formatoPesos } from "@/lib/format";
import {
  cuotasHabilitadasDe,
  interesModoDe,
  moraCreditoDe,
  moraCuentaDe,
  textoCuotas,
  textoMoraSemanal,
} from "@/lib/politica-cliente";
import { etiquetaFormaPago, nombreVisible } from "@/lib/venta-texto";

const CAMPO = caja.campo;
const TASAS_BASE = { 1: 15, 2: 25, 3: 35, 6: 50 };
const MORA_BASE = [5, 10, 20, 40];

function diaArgentina(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

function mesArgentina(iso: string) {
  const dia = diaArgentina(iso);
  return dia.slice(0, 7);
}

export function CajaFichaCliente({
  persona,
  compras,
  deuda,
  tasasCuota,
  moraCredito = MORA_BASE,
  moraCuenta = MORA_BASE,
  plazoGeneral = 7,
  onVolver,
  onElegir,
  onActualizado,
}: {
  persona: PersonaCaja;
  compras: CompraCaja[];
  deuda: DeudaCaja | null;
  tasasCuota?: { 1: number; 2: number; 3: number; 6: number };
  moraCredito?: number[];
  moraCuenta?: number[];
  plazoGeneral?: number;
  onVolver: () => void;
  onElegir?: () => void;
  onActualizado?: (persona: PersonaCaja) => void;
}) {
  const [parche, setParche] = useState<PersonaCaja | null>(null);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState("");
  const actual = parche?.id === persona.id ? parche : persona;
  const tasas = tasasCuota ?? TASAS_BASE;

  const nombre = nombreVisible(actual);
  const propias = compras
    .filter((c) => !c.anulada)
    .filter((c) => {
      if (c.clienteId && c.clienteId === persona.id) return true;
      return c.cliente.trim().toLowerCase() === nombre.toLowerCase();
    })
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const hoy = diaArgentina(new Date().toISOString());
  const esteMes = hoy.slice(0, 7);
  const [anio, mes] = esteMes.split("-").map(Number);
  const anterior = new Date(anio, mes - 2, 1);
  const mesAnterior = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, "0")}`;
  const delMes = propias.filter((c) => mesArgentina(c.creadoEn) === esteMes);
  const delAnterior = propias.filter((c) => mesArgentina(c.creadoEn) === mesAnterior);
  const total = propias.reduce((s, c) => s + c.total, 0);
  const totalMes = delMes.reduce((s, c) => s + c.total, 0);
  const totalAnterior = delAnterior.reduce((s, c) => s + c.total, 0);
  const promedio = propias.length ? Math.round(total / propias.length) : 0;
  const ultima = propias[0];
  const tieneCredito = actual.limiteEfectivo > 0;
  const tieneCuenta = actual.limiteAlmacen > 0;
  const cuotas = cuotasHabilitadasDe(actual);
  const modoInteres = interesModoDe(actual);
  const moraC = moraCreditoDe(actual);
  const moraM = moraCuentaDe(actual);
  const interesPropio = cuotas
    .map((plazo) => {
      const valor = plazo === 1 ? actual.interes1 : plazo === 2 ? actual.interes2 : plazo === 3 ? actual.interes3 : actual.interes6;
      return `${plazo}: ${valor ?? tasas[plazo]}%`;
    })
    .join(" · ");

  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={caja.kicker}>Ficha de cliente</p>
          <h2 className="font-display text-4xl font-bold tracking-tight">{nombre}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {[actual.codigo && `Cód. ${actual.codigo}`, actual.documento, actual.telefono]
              .filter(Boolean)
              .join(" · ") || "Sin código ni documento"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAviso("");
              setEditando((v) => !v);
            }}
            className={caja.boton}
          >
            {editando ? "Cerrar" : "Modificar"}
          </button>
          {onElegir && (
            <button type="button" onClick={onElegir} className={caja.primario}>
              Venderle
            </button>
          )}
          <button type="button" onClick={onVolver} className={caja.boton}>
            Volver
          </button>
        </div>
      </div>

      {aviso && <p className={`${caja.avisoOkPlano} mt-4`}>{aviso}</p>}

      {editando ? (
        <EditorCliente
          persona={actual}
          tasas={tasas}
          moraCredito={moraCredito}
          moraCuenta={moraCuenta}
          plazoGeneral={plazoGeneral}
          onCancelar={() => setEditando(false)}
          onGuardado={(siguiente, mensaje) => {
            setParche(siguiente);
            onActualizado?.(siguiente);
            setEditando(false);
            setAviso(mensaje);
          }}
        />
      ) : (
        <>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Dato etiqueta="Dirección" valor={actual.direccion || "Sin cargar"} />
            <Dato etiqueta="Cumpleaños" valor={actual.cumpleanos || "Sin cargar"} />
            <Dato etiqueta="Descuento de ficha" valor={actual.descuento > 0 ? `${actual.descuento}%` : "Sin descuento especial"} />
            <Dato etiqueta="Cuenta web" valor={actual.cuentaWeb ? actual.email : "Solo cliente de caja"} />
          </dl>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <article className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className={caja.kicker}>Crédito</p>
              <h3 className="font-display text-2xl font-bold">{tieneCredito ? formatoPesos(actual.limiteEfectivo) : "Sin acceso"}</h3>
              {tieneCredito ? (
                <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                  <li>Cuotas: {textoCuotas(cuotas)}</li>
                  <li>{modoInteres === "propio" ? `Interés de esta ficha. ${interesPropio}` : "Interés de la escala general"}</li>
                  <li>{textoMoraSemanal(moraC.modo, moraC.porcentaje, "Si se vencen", moraCredito)}</li>
                </ul>
              ) : (
                <p className="mt-2 text-sm text-neutral-600">Este cliente no puede llevarse plata en cuotas.</p>
              )}
            </article>
            <article className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className={caja.kicker}>Cuenta corriente</p>
              <h3 className="font-display text-2xl font-bold">{tieneCuenta ? formatoPesos(actual.limiteAlmacen) : "Sin acceso"}</h3>
              {tieneCuenta ? (
                <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                  <li>
                    {actual.plazoCuenta
                      ? `${actual.plazoCuenta} días para pagar la mercadería`
                      : `El plazo general, ${plazoGeneral} días`}
                  </li>
                  <li>{textoMoraSemanal(moraM.modo, moraM.porcentaje, "Si no paga", moraCuenta)}</li>
                </ul>
              ) : (
                <p className="mt-2 text-sm text-neutral-600">No tiene mercadería fiada.</p>
              )}
            </article>
          </div>
          {actual.nota && <p className={`${caja.nota} mt-3`}>{actual.nota}</p>}
        </>
      )}

      {deuda && deuda.debe > 0 && (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">
          Deuda pendiente {formatoPesos(deuda.debe)}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat titulo="Este mes" valor={formatoPesos(totalMes)} detalle={`${delMes.length} compras`} />
        <Stat titulo="Mes anterior" valor={formatoPesos(totalAnterior)} detalle={`${delAnterior.length} compras`} />
        <Stat titulo="Total" valor={formatoPesos(total)} detalle={`${propias.length} comprobantes`} />
        <Stat titulo="Ticket promedio" valor={formatoPesos(promedio)} detalle={ultima ? `Última ${diaArgentina(ultima.creadoEn)}` : "Sin compras"} />
      </div>

      <h3 className="mt-8 font-display text-2xl font-bold">Comprobantes</h3>
      <ul className="mt-3 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        {propias.length === 0 && (
          <li className="px-4 py-5 text-sm text-neutral-600">Todavía no hay facturas de caja a este nombre.</li>
        )}
        {propias.slice(0, 40).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 text-sm last:border-0">
            <span>
              <span className="font-bold">Factura {c.numero}</span>
              <span className="text-neutral-500">
                {" · "}
                {diaArgentina(c.creadoEn)}
                {" · "}
                {etiquetaFormaPago(c.formaPago)}
              </span>
            </span>
            <span className="flex items-center gap-3 font-bold">
              {formatoPesos(c.total)}
              <a className="text-sm font-semibold underline" href={`/caja/comprobante/${c.id}?formato=a4`}>A4</a>
              <a className="text-sm font-semibold underline" href={`/caja/comprobante/${c.id}?formato=ticket`}>Ticket</a>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditorCliente({
  persona,
  tasas,
  moraCredito,
  moraCuenta,
  plazoGeneral,
  onCancelar,
  onGuardado,
}: {
  persona: PersonaCaja;
  tasas: { 1: number; 2: number; 3: number; 6: number };
  moraCredito: number[];
  moraCuenta: number[];
  plazoGeneral: number;
  onCancelar: () => void;
  onGuardado: (persona: PersonaCaja, mensaje: string) => void;
}) {
  const [web, setWeb] = useState(false);
  const [credito, setCredito] = useState(persona.limiteEfectivo > 0);
  const [corriente, setCorriente] = useState(persona.limiteAlmacen > 0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("id", persona.id);
        if (!persona.cuentaWeb && web) data.set("cuentaWeb", "1");
        if (credito) data.set("credito", "1");
        if (corriente) data.set("cuentaCorriente", "1");
        setError("");
        start(async () => {
          const r = await actualizarClienteCaja(data);
          if (r?.error) {
            setError(r.error);
            return;
          }
          if (r?.cliente) onGuardado(r.cliente, r.ok ?? "Datos actualizados.");
        });
      }}
    >
      <h3 className="font-display text-2xl font-bold">Modificar datos</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Código" nombre="codigo" valor={persona.codigo} />
        <Campo etiqueta="Descuento especial %" nombre="descuento" valor={persona.descuento || ""} modo="numeric" />
        <Campo etiqueta="Nombre" nombre="nombre" valor={persona.nombre} requerido />
        <Campo etiqueta="Apellido" nombre="apellidos" valor={persona.apellido} />
        <label className="text-sm font-bold sm:col-span-2">
          Dirección
          <input name="direccion" defaultValue={persona.direccion} className={`${CAMPO} mt-1`} />
        </label>
        <Campo etiqueta="Teléfono" nombre="telefono" valor={persona.telefono} requerido modo="tel" />
        <label className="text-sm font-bold">
          Cumpleaños
          <input name="cumpleanos" type="date" defaultValue={persona.cumpleanos} className={`${CAMPO} mt-1`} />
        </label>
        <label className="text-sm font-bold sm:col-span-2">
          CUIT o DNI
          <input name="documento" defaultValue={persona.documento} className={`${CAMPO} mt-1`} />
        </label>
        <label className="text-sm font-bold sm:col-span-2">
          Nota
          <textarea name="nota" rows={2} defaultValue={persona.nota} className={`${CAMPO} mt-1`} />
        </label>
      </div>

      {persona.cuentaWeb ? (
        <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
          <p className="text-sm font-bold">Ya tiene usuario web: {persona.email}</p>
          <label className="mt-2 block text-sm font-bold">
            Nueva contraseña
            <input name="password" placeholder="Dejar vacío para no cambiarla" className={`${CAMPO} mt-1`} />
          </label>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
          <p className="text-sm text-neutral-600">Solo está cargado en la caja, sin usuario web.</p>
          <label className="mt-2 flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
            Crearle usuario y contraseña
          </label>
          {web && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Campo etiqueta="Mail" nombre="email" requerido tipo="email" />
              <Campo etiqueta="Contraseña" nombre="password" requerido />
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
          Condiciones de pago
        </p>
        <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={credito}
            onChange={(e) => setCredito(e.target.checked)}
          />
          <span>
            <span className="block font-black">Préstamos</span>
            <span className="text-xs font-semibold text-neutral-600">
              Crédito en efectivo / dinero prestado (con cuotas).
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={corriente}
            onChange={(e) => setCorriente(e.target.checked)}
          />
          <span>
            <span className="block font-black">Cuenta corriente de mercadería</span>
            <span className="text-xs font-semibold text-neutral-600">
              Lleva productos y los paga después, dentro del plazo.
            </span>
          </span>
        </label>
      </div>
      {(credito || corriente) && (
        <CondicionesCliente
          credito={credito}
          corriente={corriente}
          ficha={persona}
          tasas={tasas}
          moraCredito={moraCredito}
          moraCuenta={moraCuenta}
          plazoGeneral={plazoGeneral}
          limiteCredito={persona.limiteEfectivo || ""}
          limiteMercaderia={persona.limiteAlmacen || ""}
        />
      )}

      {error && <p className={`${caja.avisoErrorPlano} mt-3`}>{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancelar} className={caja.boton}>
          Cancelar
        </button>
        <button type="submit" disabled={pending} className={caja.primario}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  etiqueta,
  nombre,
  valor = "",
  requerido,
  modo,
  tipo = "text",
}: {
  etiqueta: string;
  nombre: string;
  valor?: string | number;
  requerido?: boolean;
  modo?: "numeric" | "tel";
  tipo?: string;
}) {
  return (
    <label className="text-sm font-bold">
      {etiqueta}
      {requerido ? " *" : ""}
      <input name={nombre} required={requerido} inputMode={modo} type={tipo} defaultValue={valor} className={`${CAMPO} mt-1`} />
    </label>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <dt className="text-xs font-semibold text-neutral-500">{etiqueta}</dt>
      <dd className="mt-1 text-sm font-semibold">{valor}</dd>
    </div>
  );
}

function Stat({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-bold">{valor}</p>
      <p className="text-xs text-neutral-500">{detalle}</p>
    </div>
  );
}
