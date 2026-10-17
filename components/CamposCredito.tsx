"use client";

import { useState } from "react";
import { caja } from "@/components/caja-estilo";
import { PLAZOS_CREDITO, type PlazoCredito } from "@/lib/credito-cuotas";
import {
  cuotasHabilitadasDe,
  interesModoDe,
  moraCreditoDe,
  moraCuentaDe,
  textoMoraSemanal,
  type FichaInteres,
  type ModoInteres,
  type ModoMora,
} from "@/lib/politica-cliente";

const CAMPO = caja.campo;

export function CondicionesCliente({
  credito,
  corriente,
  ficha,
  tasas,
  moraCredito,
  moraCuenta,
  plazoGeneral,
  limiteCredito = "",
  limiteMercaderia = "",
}: {
  credito: boolean;
  corriente: boolean;
  ficha?: (FichaInteres & { plazoCuenta?: number | null }) | null;
  tasas: { 1: number; 2: number; 3: number; 6: number };
  moraCredito: number[];
  moraCuenta: number[];
  plazoGeneral: number;
  limiteCredito?: number | "";
  limiteMercaderia?: number | "";
}) {
  const iniciales = cuotasHabilitadasDe(ficha);
  const [cuotas, setCuotas] = useState<PlazoCredito[]>(iniciales);
  const [interesModo, setInteresModo] = useState<ModoInteres>(interesModoDe(ficha));
  const creditoMora = moraCreditoDe(ficha);
  const cuentaMora = moraCuentaDe(ficha);
  const [moraCreditoModo, setMoraCreditoModo] = useState<ModoMora>(creditoMora.modo);
  const [moraCuentaModo, setMoraCuentaModo] = useState<ModoMora>(cuentaMora.modo);
  const [plazoOrigen, setPlazoOrigen] = useState(ficha?.plazoCuenta ? "propio" : "general");
  const [plazoDias, setPlazoDias] = useState(String(ficha?.plazoCuenta || 7));
  const todas = PLAZOS_CREDITO.every((plazo) => cuotas.includes(plazo));
  const intereses: Record<PlazoCredito, number | null | undefined> = {
    1: ficha?.interes1,
    2: ficha?.interes2,
    3: ficha?.interes3,
    6: ficha?.interes6,
  };

  function marcar(plazo: PlazoCredito, activo: boolean) {
    setCuotas((prev) => {
      const siguiente = activo ? [...prev, plazo] : prev.filter((item) => item !== plazo);
      return PLAZOS_CREDITO.filter((item) => siguiente.includes(item));
    });
  }

  return (
    <div className="mt-3 space-y-3">
      {credito && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="font-display text-lg font-bold">Préstamos</p>
          <p className="mt-1 text-xs text-neutral-600">
            Crédito en efectivo. Elegí qué cuotas puede usar. El interés de cada cuota puede ser el general o uno de esta ficha. Si se vence, el interés por no pagar es semanal.
          </p>
          <label className="mt-3 block text-sm font-bold">
            Límite
            <input name="limiteCredito" inputMode="numeric" required defaultValue={limiteCredito || ""} className={`${CAMPO} mt-1`} />
          </label>
          <fieldset className="mt-3">
            <legend className="text-sm font-bold">Cuotas habilitadas</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={todas}
                  onChange={(e) => setCuotas(e.target.checked ? [...PLAZOS_CREDITO] : [])}
                />
                Todas
              </label>
              {PLAZOS_CREDITO.map((plazo) => (
                <label key={plazo} className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    name={`cuota${plazo}`}
                    value="1"
                    checked={cuotas.includes(plazo)}
                    onChange={(e) => marcar(plazo, e.target.checked)}
                  />
                  {plazo} {plazo === 1 ? "cuota" : "cuotas"}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-3">
            <legend className="text-sm font-bold">Interés de la cuota</legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="radio" name="interesModo" value="general" checked={interesModo === "general"} onChange={() => setInteresModo("general")} />
              Escala general ({PLAZOS_CREDITO.map((plazo) => `${plazo}: ${tasas[plazo]}%`).join(" · ")})
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="radio" name="interesModo" value="propio" checked={interesModo === "propio"} onChange={() => setInteresModo("propio")} />
              Personalizar esta ficha
            </label>
            {interesModo === "propio" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {cuotas.map((plazo) => (
                  <label key={plazo} className="text-sm font-bold">
                    {plazo} {plazo === 1 ? "cuota" : "cuotas"} %
                    <input
                      name={`interes${plazo}`}
                      inputMode="decimal"
                      required
                      defaultValue={intereses[plazo] ?? ""}
                      placeholder={String(tasas[plazo])}
                      className={`${CAMPO} mt-1`}
                    />
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <MoraSemanal
            titulo="Si se vencen las cuotas"
            nombre="moraCreditoModo"
            porcentaje="moraCreditoPorcentaje"
            modo={moraCreditoModo}
            onModo={setMoraCreditoModo}
            valor={creditoMora.porcentaje || ""}
            escala={textoMoraSemanal("escala", 0, "General", moraCredito).replace("General: ", "")}
          />
        </div>
      )}
      {corriente && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="font-display text-lg font-bold">Cuenta corriente de mercadería</p>
          <p className="mt-1 text-xs text-neutral-600">
            La mercadería no tiene interés durante el plazo. Pasado ese plazo, cada semana de impago suma la tarifa que elijas.
          </p>
          <label className="mt-3 block text-sm font-bold">
            Límite de mercadería
            <input name="limiteMercaderia" inputMode="numeric" required defaultValue={limiteMercaderia || ""} className={`${CAMPO} mt-1`} />
          </label>
          <fieldset className="mt-3">
            <legend className="text-sm font-bold">Días para pagar</legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="radio" name="plazoOrigen" value="general" checked={plazoOrigen === "general"} onChange={() => setPlazoOrigen("general")} />
              El general, {plazoGeneral} días
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="radio" name="plazoOrigen" value="propio" checked={plazoOrigen === "propio"} onChange={() => setPlazoOrigen("propio")} />
              De esta ficha
            </label>
            {plazoOrigen === "propio" && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {[7, 14].map((dias) => (
                  <button key={dias} type="button" className={caja.boton} onClick={() => setPlazoDias(String(dias))}>
                    {dias} días
                  </button>
                ))}
                <label className="text-sm font-bold">
                  Otra cantidad
                  <input
                    name="plazoCuenta"
                    inputMode="numeric"
                    required
                    min={1}
                    max={365}
                    value={plazoDias}
                    onChange={(e) => setPlazoDias(e.target.value)}
                    className={`${CAMPO} mt-1 w-28`}
                  />
                </label>
              </div>
            )}
          </fieldset>
          <MoraSemanal
            titulo="Si no paga la mercadería"
            nombre="moraCuentaModo"
            porcentaje="moraCuentaPorcentaje"
            modo={moraCuentaModo}
            onModo={setMoraCuentaModo}
            valor={cuentaMora.porcentaje || ""}
            escala={textoMoraSemanal("escala", 0, "General", moraCuenta).replace("General: ", "")}
          />
        </div>
      )}
    </div>
  );
}

function MoraSemanal({
  titulo,
  nombre,
  porcentaje,
  modo,
  onModo,
  valor,
  escala,
}: {
  titulo: string;
  nombre: string;
  porcentaje: string;
  modo: ModoMora;
  onModo: (modo: ModoMora) => void;
  valor: number | "";
  escala: string;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="text-sm font-bold">{titulo}</legend>
      <label className="mt-2 flex items-start gap-2 text-sm">
        <input type="radio" name={nombre} value="escala" checked={modo === "escala"} onChange={() => onModo("escala")} className="mt-1" />
        <span>Escala general. {escala}</span>
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="radio" name={nombre} value="fijo" checked={modo === "fijo"} onChange={() => onModo("fijo")} />
        Un porcentaje semanal de esta ficha
      </label>
      {modo === "fijo" && (
        <label className="mt-2 block text-sm font-bold">
          % por semana
          <input name={porcentaje} inputMode="numeric" required min={1} max={100} defaultValue={valor} placeholder="Ej. 10" className={`${CAMPO} mt-1 w-28`} />
        </label>
      )}
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="radio" name={nombre} value="sin" checked={modo === "sin"} onChange={() => onModo("sin")} />
        Sin interés por atraso
      </label>
    </fieldset>
  );
}
