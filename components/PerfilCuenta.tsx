"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { solicitarRecargaSaldo } from "@/app/acciones/pedidos";
import { formatoFecha, formatoPesos, nombreVitrina } from "@/lib/format";
import { interesDeTicket, numeroVisibleTicket, vencimientoDeTicket } from "@/lib/deuda";
import { moraCreditoDe, moraCuentaDe, politicaDeCliente, textoMoraSemanal } from "@/lib/politica-cliente";
import { simularCredito, tasasCredito, type PlazoCredito } from "@/lib/credito-cuotas";
import type { TicketDeuda } from "@/types/cuenta";

export type LineaCompraPerfil = {
  nombre: string;
  cantidad: number;
  monto: number;
};

export type CompraPerfil = {
  id: string;
  fecha: string;
  origen: "local" | "web";
  titulo: string;
  total: number;
  detalle: string;
  descarga?: string;
  lineas: LineaCompraPerfil[];
  proceso?: { paso: number; nota: string };
  entrega?: string;
};

const PASOS_PEDIDO = ["Recibido", "En preparación", "Entregado"];

function PasosPedido({ paso, nota }: { paso: number; nota: string }) {
  const actual = Math.min(PASOS_PEDIDO.length - 1, Math.max(0, paso));
  return (
    <div className="mb-3">
      <ol className="grid grid-cols-3 gap-2">
        {PASOS_PEDIDO.map((nombre, i) => (
          <li key={nombre}>
            <span
              className={`block h-1.5 rounded-full ${i <= actual ? "bg-[#009ee3]" : "bg-neutral-200"}`}
            />
            <span
              className={`mt-1 block text-[11px] font-semibold ${
                i === actual ? "text-neutral-950" : "text-neutral-400"
              }`}
            >
              {nombre}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-neutral-700">{nota}</p>
    </div>
  );
}

function Saldo({
  titulo,
  limite,
  usado,
  vacio,
  detalleVacio,
}: {
  titulo: string;
  limite: number;
  usado: number;
  vacio: string;
  detalleVacio: string;
}) {
  const disponible = Math.max(0, limite - usado);
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  return (
    <article className="rounded-2xl bg-white px-5 py-5 shadow-sm">
      <p className="text-sm text-neutral-500">{titulo}</p>
      {limite <= 0 ? (
        <>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">{vacio}</p>
          <p className="mt-2 text-sm text-neutral-500">{detalleVacio}</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            {formatoPesos(disponible)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">Disponible</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-[#009ee3]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            Usado {formatoPesos(usado)} de {formatoPesos(limite)}
          </p>
        </>
      )}
    </article>
  );
}

function MontoGrande({ valor }: { valor: number }) {
  const texto = Math.max(0, Math.round(valor)).toLocaleString("es-AR");
  return (
    <p className="font-semibold tracking-tight text-neutral-950">
      <span className="align-top text-2xl">$</span>
      <span className="text-5xl sm:text-6xl">{texto}</span>
      <span className="text-2xl">,00</span>
    </p>
  );
}

export function PerfilCuenta({
  nombre,
  saldo,
  alias,
  cbu,
  titular,
  nombreLocal,
  limiteCredito,
  usadoCredito,
  cuotasMaximas,
  cuotasHabilitadas,
  interesModo,
  interes1,
  interes2,
  interes3,
  interes6,
  limiteMercaderia,
  usadoMercaderia,
  moraModo,
  moraPorcentaje,
  moraCreditoModo,
  moraCreditoPorcentaje,
  moraCuentaModo,
  moraCuentaPorcentaje,
  moraCredito,
  moraCuenta,
  tasasCuota,
  plazoCuenta,
  aliasCliente,
  onFaltaAlias,
  tickets,
  compras,
}: {
  nombre: string;
  saldo: number;
  alias: string;
  cbu: string;
  titular: string;
  nombreLocal: string;
  limiteCredito: number;
  usadoCredito: number;
  cuotasMaximas?: 1 | 2 | 3 | 6;
  cuotasHabilitadas?: (1 | 2 | 3 | 6)[];
  interesModo?: "general" | "propio";
  interes1?: number;
  interes2?: number;
  interes3?: number;
  interes6?: number;
  limiteMercaderia: number;
  usadoMercaderia: number;
  moraModo?: "escala" | "fijo" | "sin";
  moraPorcentaje?: number;
  moraCreditoModo?: "escala" | "fijo" | "sin";
  moraCreditoPorcentaje?: number;
  moraCuentaModo?: "escala" | "fijo" | "sin";
  moraCuentaPorcentaje?: number;
  moraCredito?: number[];
  moraCuenta?: number[];
  tasasCuota?: { 1: number; 2: number; 3: number; 6: number };
  plazoCuenta?: number;
  aliasCliente?: string;
  onFaltaAlias?: () => void;
  tickets: TicketDeuda[];
  compras: CompraPerfil[];
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pantalla, setPantalla] = useState<"inicio" | "cargar" | "transferir" | "credito">("inicio");
  const [monto, setMonto] = useState("");
  const [aviso, setAviso] = useState("");
  const [simulacion, setSimulacion] = useState("");
  const [plazo, setPlazo] = useState<PlazoCredito>(1);
  const [pending, start] = useTransition();
  const credito = tasasCredito({
    cuotasMaximas,
    cuotasHabilitadas,
    interesModo,
    interes1,
    interes2,
    interes3,
    interes6,
    bases: tasasCuota,
  });
  const disponibleCredito = Math.max(0, limiteCredito - usadoCredito);
  const montoNum = Math.round(Number(monto) || 0);
  const politica = politicaDeCliente(
    {
      moraModo,
      moraPorcentaje,
      moraCreditoModo,
      moraCreditoPorcentaje,
      moraCuentaModo,
      moraCuentaPorcentaje,
    },
    { moraCredito, moraCuenta },
  );
  const moraDeCuenta = moraCuentaDe(politica);
  const moraDeCredito = moraCreditoDe(politica);
  const pagos = tickets
    .filter((t) => t.debe > 0 && t.estado !== "pagada")
    .map((t) => {
      const interes = interesDeTicket(t, undefined, politica);
      return { ticket: t, interes, vence: vencimientoDeTicket(t) };
    })
    .sort((a, b) => a.vence.localeCompare(b.vence));
  const avisoMora = `La mercadería del local no tiene interés. Tenés ${plazoCuenta ?? 7} días para pagarla. ${textoMoraSemanal(moraDeCuenta.modo, moraDeCuenta.porcentaje, "Pasado ese plazo", moraCuenta)}${limiteCredito > 0 ? ` ${textoMoraSemanal(moraDeCredito.modo, moraDeCredito.porcentaje, "Si se vence un crédito", moraCredito)}` : ""}`;

  function tecla(digito: string) {
    setMonto((actual) => {
      const siguiente = `${actual}${digito}`.replace(/^0+(?=\d)/, "");
      if (siguiente.length > 7) return actual;
      return siguiente;
    });
  }

  function confirmarTransferencia() {
    setAviso("");
    start(async () => {
      const resultado = await solicitarRecargaSaldo(montoNum);
      if (resultado?.error) {
        setAviso(resultado.error);
        return;
      }
      setAviso(resultado?.ok ?? "Listo.");
      setPantalla("inicio");
      setMonto("");
      router.refresh();
    });
  }

  const simulada = simularCredito(
    Math.min(disponibleCredito, Math.round(Number(simulacion) || 0)),
    plazo,
    credito.tasas[plazo],
  );

  return (
    <div className="space-y-3 rounded-3xl bg-[#f5f5f5] p-3 sm:p-4">
      <header className="flex items-center gap-3 px-2 pt-2">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#009ee3] text-lg font-bold text-white">
          {nombre.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="text-sm text-neutral-500">Hola</p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">{nombre}</h1>
        </div>
      </header>
      {aviso && pantalla === "inicio" && (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-800">{aviso}</p>
      )}

      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)]">
        <article className="rounded-3xl bg-white px-5 py-6 shadow-sm">
          <p className="text-sm font-semibold text-neutral-500">Pesos</p>
          <div className="mt-2">
            <MontoGrande valor={saldo} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">Saldo a cuenta</p>
          <button
            type="button"
            onClick={() => {
              setAviso("");
              setMonto("");
              setPantalla("cargar");
            }}
            className="mt-5 rounded-full bg-[#009ee3] px-5 py-3 text-sm font-bold text-white"
          >
            Agregar saldo
          </button>
        </article>

        <article className="relative overflow-hidden rounded-3xl bg-neutral-950 px-5 py-6 text-white shadow-sm">
          <span className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-[#009ee3]/40" />
          <p className="text-sm text-white/70">Créditos</p>
          {limiteCredito <= 0 ? (
            <p className="mt-6 text-xl font-semibold leading-snug">Todavía no tenés línea de crédito</p>
          ) : (
            <>
              <p className="mt-4 text-sm text-white/70">Con tu línea podés pedir hasta</p>
              <p className="mt-1 text-3xl font-semibold">{formatoPesos(disponibleCredito)}</p>
              <p className="mt-1 text-xs text-white/50">
                Usado {formatoPesos(usadoCredito)} de {formatoPesos(limiteCredito)}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!aliasCliente?.trim()) {
                    onFaltaAlias?.();
                    return;
                  }
                  setSimulacion(String(Math.min(disponibleCredito, 10000) || ""));
                  setPlazo(credito.plazos[0] ?? 1);
                  setPantalla("credito");
                }}
                className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-neutral-950"
              >
                Pedir crédito
              </button>
            </>
          )}
        </article>
      </div>

      <Saldo
        titulo="Cuenta corriente de mercadería"
        limite={limiteMercaderia}
        usado={usadoMercaderia}
        vacio="No tenés cuenta de mercadería"
        detalleVacio="Cuando el local te habilite una, el disponible aparece acá."
      />

      <p className="px-2 text-sm text-neutral-500">{avisoMora}</p>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <h2 className="border-b border-neutral-100 px-5 py-4 text-lg font-semibold text-neutral-950">
          A pagar
        </h2>
        {pagos.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-500">No tenés pagos pendientes.</p>
        ) : (
          <ul>
            {pagos.map(({ ticket, interes, vence }) => (
              <li key={ticket.id} className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4 last:border-b-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f7ff] text-sm font-bold text-[#009ee3]">
                  $
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-950">
                    Vence {formatoFecha(vence)}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {ticket.tipo === "efectivo" ? "Crédito" : "Mercadería"}
                    {" · "}
                    {ticket.origen === "web" ? "Pedido por internet" : "Compra en el local"}
                    {interes.interes > 0 ? ` · mora ${formatoPesos(interes.interes)}` : ""}
                  </span>
                </span>
                <span className="text-sm font-semibold text-neutral-950">
                  {formatoPesos(ticket.debe + interes.interes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <h2 className="border-b border-neutral-100 px-5 py-4 text-lg font-semibold text-neutral-950">
          Actividad
        </h2>
        {compras.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-500">Todavía no hay compras en esta cuenta.</p>
        ) : (
          <ul>
            {compras.map((compra) => {
              const abiertaAhora = abierta === compra.id;
              return (
                <li key={compra.id} className="border-b border-neutral-100 last:border-b-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-5 py-4 text-left"
                    onClick={() => setAbierta(abiertaAhora ? null : compra.id)}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        compra.origen === "web"
                          ? "bg-[#e8f7ff] text-[#009ee3]"
                          : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {compra.origen === "web" ? "Web" : "Local"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-950">
                        {compra.titulo}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        {formatoFecha(compra.fecha.slice(0, 10))} · {compra.detalle}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-neutral-950">
                      {formatoPesos(compra.total)}
                    </span>
                    <span className="text-lg leading-none text-neutral-300">{abiertaAhora ? "˅" : "›"}</span>
                  </button>
                  {abiertaAhora && (
                    <div className="bg-[#fafafa] px-5 py-3">
                      <p className="text-xs font-semibold text-neutral-500">
                        {compra.origen === "web" ? "Pedido por internet" : "Compra en el local"} ·{" "}
                        {numeroVisibleTicket({ id: compra.id, numero: compra.titulo })}
                      </p>
                      {compra.proceso && <PasosPedido paso={compra.proceso.paso} nota={compra.proceso.nota} />}
                      {compra.entrega && (
                        <p className="mt-2 text-sm text-neutral-600">Entrega: {compra.entrega}</p>
                      )}
                      {compra.lineas.length === 0 ? (
                        <p className="mt-2 text-sm text-neutral-600">Este comprobante no tiene el detalle de productos.</p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                          {compra.lineas.map((linea, i) => (
                            <li key={`${compra.id}-${i}`} className="flex justify-between gap-3">
                              <span>
                                {linea.cantidad} × {nombreVitrina(linea.nombre)}
                              </span>
                              <span>{formatoPesos(linea.monto)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {compra.descarga && (
                        <a
                          href={compra.descarga}
                          className="mt-3 inline-flex text-sm font-semibold text-[#009ee3]"
                        >
                          Descargar ticket
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pantalla === "cargar" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <section className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <p className="text-center text-sm text-neutral-500">¿Cuánto saldo querés cargar?</p>
            <div className="mt-3 text-center">
              <MontoGrande valor={montoNum} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((digito) => (
                <button
                  key={digito}
                  type="button"
                  onClick={() => tecla(digito)}
                  className={`h-14 rounded-2xl bg-neutral-100 text-2xl font-semibold ${digito === "0" ? "col-start-2" : ""}`}
                >
                  {digito}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMonto((actual) => actual.slice(0, -1))}
                className="col-start-3 h-14 rounded-2xl text-sm font-bold text-neutral-600"
              >
                Borrar
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="rounded-full border border-neutral-200 py-3 text-sm font-bold" onClick={() => setPantalla("inicio")}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={montoNum < 1}
                className="rounded-full bg-[#009ee3] py-3 text-sm font-bold text-white disabled:opacity-40"
                onClick={() => setPantalla("transferir")}
              >
                Continuar
              </button>
            </div>
          </section>
        </div>
      )}

      {pantalla === "transferir" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <p className="text-sm font-semibold text-neutral-500">Transferí {formatoPesos(montoNum)}</p>
            <p className="mt-1 text-lg font-semibold text-neutral-950">{nombreLocal || "La Triple L"}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">Titular</p>
            <p className="text-2xl font-semibold">{titular || "El local todavía no cargó el titular"}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">Alias</p>
            <p className="break-all text-3xl font-semibold text-[#009ee3]">{alias || "Sin alias"}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">CBU</p>
            <p className="break-all text-xl font-semibold">{cbu || "Sin CBU"}</p>
            {aviso && <p className="mt-3 text-sm font-semibold text-red-700">{aviso}</p>}
            <div className="mt-6 grid gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={confirmarTransferencia}
                className="rounded-full bg-[#009ee3] py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {pending ? "Avisando…" : "Ya transferí"}
              </button>
              <button type="button" className="rounded-full py-3 text-sm font-bold text-neutral-600" onClick={() => setPantalla("inicio")}>
                Cancelar ingreso
              </button>
            </div>
          </section>
        </div>
      )}

      {pantalla === "credito" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-sm text-neutral-500">Simulá tu línea</p>
            <h2 className="text-2xl font-semibold">Pedir crédito</h2>
            <p className="mt-1 text-sm text-neutral-500">Disponible {formatoPesos(disponibleCredito)}</p>
            <label className="mt-4 block text-sm font-semibold">
              Monto
              <input
                inputMode="numeric"
                value={simulacion}
                onChange={(e) => setSimulacion(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-3 text-2xl font-semibold outline-none focus:border-[#009ee3]"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {credito.plazos.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => setPlazo(opcion)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    plazo === opcion ? "bg-[#009ee3] text-white" : "bg-neutral-100 text-neutral-800"
                  }`}
                >
                  {opcion} {opcion === 1 ? "cuota" : "cuotas"}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-[#f5f5f5] p-4">
              <p className="text-sm text-neutral-500">Cada cuota</p>
              <p className="text-3xl font-semibold">{formatoPesos(simulada.cuota)}</p>
              <p className="mt-2 text-sm text-neutral-600">
                Total {formatoPesos(simulada.total)} · interés {formatoPesos(simulada.interes)}
              </p>
            </div>
            <button type="button" className="mt-4 w-full rounded-full border border-neutral-200 py-3 text-sm font-bold" onClick={() => setPantalla("inicio")}>
              Volver
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
