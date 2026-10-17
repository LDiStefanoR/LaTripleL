"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { cargarClienteCaja } from "@/app/acciones/deposito";
import { caja } from "@/components/caja-estilo";
import { CajaClienteForm } from "@/components/CajaClienteForm";
import { CajaFichaCliente } from "@/components/CajaFichaCliente";
import type { CompraCaja, DeudaCaja, PersonaCaja } from "@/components/CajaDeposito";
import { formatoPesos } from "@/lib/format";
import { nombreVisible } from "@/lib/venta-texto";

function deudaDe(persona: PersonaCaja, deudas: DeudaCaja[]) {
  const email = persona.email.trim().toLowerCase();
  const porMail = deudas.find((d) => d.email.trim().toLowerCase() === email);
  if (porMail) return porMail;
  const tel = persona.telefono.replace(/\D/g, "");
  if (tel.length < 8) return null;
  const porTel = deudas.filter((d) => d.telefono.replace(/\D/g, "") === tel);
  return porTel.length === 1 ? porTel[0] : null;
}

const CAMPO = caja.campo;

export function CajaBuscarCliente({
  personas,
  deudas,
  compras,
  cliente,
  esAdmin,
  tasasCuota,
  moraCredito,
  moraCuenta,
  plazoGeneral,
  onElegir,
  onAbrirDeudas,
}: {
  personas: PersonaCaja[];
  deudas: DeudaCaja[];
  compras: CompraCaja[];
  cliente: PersonaCaja | null;
  esAdmin: boolean;
  tasasCuota?: { 1: number; 2: number; 3: number; 6: number };
  moraCredito?: number[];
  moraCuenta?: number[];
  plazoGeneral?: number;
  onElegir: (persona: PersonaCaja | null) => void;
  onAbrirDeudas?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [alta, setAlta] = useState(false);
  const [ficha, setFicha] = useState<PersonaCaja | null>(null);
  const [verDeuda, setVerDeuda] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [codigo, setCodigo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [documento, setDocumento] = useState("");
  const [aviso, setAviso] = useState("");
  const [pending, start] = useTransition();

  const clientes = useMemo(
    () => personas.filter((p) => p.rol === "cliente").sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [personas],
  );
  const resultados = useMemo(() => {
    const n = nombre.trim().toLowerCase();
    const a = apellido.trim().toLowerCase();
    const c = codigo.trim().toLowerCase();
    const tel = telefono.replace(/\D/g, "");
    const doc = documento.replace(/\D/g, "");
    return clientes.filter((p) => {
      if (n && !p.nombre.toLowerCase().includes(n)) return false;
      if (a && !(p.apellido || "").toLowerCase().includes(a)) return false;
      if (c && !(p.codigo || "").toLowerCase().includes(c)) return false;
      if (tel && !p.telefono.replace(/\D/g, "").includes(tel)) return false;
      if (doc && !(p.documento || "").replace(/\D/g, "").includes(doc)) return false;
      return true;
    });
  }, [clientes, nombre, apellido, codigo, telefono, documento]);

  const deuda = cliente ? deudaDe(cliente, deudas) : null;

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "F4") {
        e.preventDefault();
        setAlta(false);
        setAbierto(true);
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  function elegir(persona: PersonaCaja) {
    onElegir(persona);
    setAbierto(false);
    setAlta(false);
    setVerDeuda(true);
  }

  function crear(form: FormData) {
    setAviso("");
    start(async () => {
      const r = await cargarClienteCaja(form);
      if (r?.error) {
        setAviso(r.error);
        return;
      }
      if (r?.cliente) {
        onElegir(r.cliente);
        setAlta(false);
        setAbierto(false);
        setVerDeuda(false);
      }
      setAviso(r?.ok ?? "Cliente cargado.");
    });
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setAlta(false);
            setAbierto(true);
          }}
          className={`${caja.primario} flex h-12 items-center gap-2 px-4`}
          title="Buscar cliente (F4)"
        >
          <span aria-hidden className="text-lg leading-none">
            👤
          </span>
          <span>Buscar cliente</span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">F4</span>
        </button>
        <p className="min-w-40 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-bold shadow-sm">
          {cliente ? nombreVisible(cliente) : "Cliente genérico"}
          {cliente && cliente.descuento > 0 ? ` · ${cliente.descuento}%` : ""}
        </p>
        <button
          type="button"
          onClick={() => {
            setAviso("");
            setAlta(true);
            setAbierto(false);
          }}
          className={`${caja.boton} h-12`}
        >
          ➕ Nuevo cliente
        </button>
        {cliente && (
          <button
            type="button"
            onClick={() => setFicha(cliente)}
            className={`${caja.boton} h-12`}
          >
            📋 Ficha
          </button>
        )}
        {cliente && (
          <button
            type="button"
            onClick={() => onElegir(null)}
            className={`${caja.boton} h-12`}
          >
            Quitar
          </button>
        )}
      </div>

      {cliente && cliente.descuento > 0 && (
        <p className={`mt-2 ${caja.nota}`}>
          Esta ficha tiene {cliente.descuento}% de descuento. La venta lo toma sola.
        </p>
      )}
      {deuda && deuda.debe > 0 && (
        <div className="mt-2 rounded border border-red-400 bg-red-50 px-3 py-2 text-sm">
          <p className="font-black text-red-900">
            {cliente ? nombreVisible(cliente) : "Este cliente"} tiene deuda pendiente de {formatoPesos(deuda.debe)}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setVerDeuda((v) => !v)}
              className="rounded border border-neutral-800 bg-white px-3 py-1.5 text-xs font-black"
            >
              {verDeuda ? "Ocultar deudas" : "Ver deudas"}
            </button>
            {esAdmin && onAbrirDeudas && (
              <button
                type="button"
                onClick={onAbrirDeudas}
                className="rounded border border-neutral-800 bg-white px-3 py-1.5 text-xs font-black"
              >
                Abrir deudas
              </button>
            )}
          </div>
          {verDeuda && (
            <ul className="mt-2 space-y-1">
              {deuda.tickets.map((t) => (
                <li key={`${t.numero}-${t.fecha}-${t.debe}`} className="flex justify-between gap-3 font-semibold">
                  <span>
                    {t.numero ? `Factura ${t.numero}` : "Ticket"} · {t.fecha}
                    {t.descripcion ? ` · ${t.descripcion}` : ""}
                  </span>
                  <span>{formatoPesos(t.debe)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {aviso && !abierto && !alta && (
        <p className="mt-2 text-sm font-bold">{aviso}</p>
      )}

      {abierto && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 p-3 pt-10">
          <section className={`${caja.popup} grid max-h-[90vh] max-w-5xl gap-4 overflow-auto lg:grid-cols-[320px_1fr]`}>
            <div>
              <h2 className="text-2xl font-black">Clientes</h2>
              <label className="mt-3 block text-sm font-bold">
                Código
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className={CAMPO} />
              </label>
              <label className="mt-2 block text-sm font-bold">
                Nombre
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`${CAMPO} bg-confetti/30`} />
              </label>
              <label className="mt-2 block text-sm font-bold">
                Apellido
                <input value={apellido} onChange={(e) => setApellido(e.target.value)} className={CAMPO} />
              </label>
              <label className="mt-2 block text-sm font-bold">
                Teléfono
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={CAMPO} />
              </label>
              <label className="mt-2 block text-sm font-bold">
                CUIT o DNI
                <input value={documento} onChange={(e) => setDocumento(e.target.value)} className={CAMPO} />
              </label>
              <p className="mt-2 text-xs font-semibold text-neutral-600">
                Si los campos están vacíos, la lista muestra todos los clientes.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="min-h-14 rounded border border-neutral-700 bg-white text-sm font-black"
                  onClick={() => {
                    setNombre("");
                    setApellido("");
                    setCodigo("");
                    setTelefono("");
                    setDocumento("");
                  }}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  className="min-h-14 rounded border border-neutral-700 bg-white text-sm font-black"
                  onClick={() => setAbierto(true)}
                >
                  Buscar
                </button>
                <button
                  type="button"
                  className="min-h-14 rounded border border-neutral-700 bg-movipack text-sm font-black text-white"
                  onClick={() => setAbierto(false)}
                >
                  Salir
                </button>
              </div>
              <button
                type="button"
                className="mt-3 min-h-12 w-full rounded border border-neutral-700 bg-white text-sm font-black"
                onClick={() => {
                  setAviso("");
                  setAlta(true);
                  setAbierto(false);
                }}
              >
                Nuevo cliente
              </button>
            </div>
            <div>
              <p className="text-sm font-black">
                Resultado de la búsqueda · {resultados.length}
              </p>
              <ul className="mt-2 max-h-[60vh] overflow-auto rounded border border-neutral-700 bg-white">
                {resultados.length === 0 && (
                  <li className="px-3 py-6 text-sm">No hay clientes con esos datos.</li>
                )}
                {resultados.map((persona) => {
                  const suDeuda = deudaDe(persona, deudas);
                  return (
                    <li key={persona.id} className="border-b border-neutral-200 last:border-0">
                      <div className="flex items-center gap-2 px-3 py-2 hover:bg-movipack/5">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => elegir(persona)}
                        >
                          <span className="block font-black">{nombreVisible(persona)}</span>
                          <span className="text-xs text-neutral-600">
                            {[persona.codigo && `Cód. ${persona.codigo}`, persona.telefono, persona.documento]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                        <span className="text-right text-xs font-bold">
                          {persona.descuento > 0 ? `${persona.descuento}%` : ""}
                          {suDeuda && suDeuda.debe > 0 ? (
                            <span className="mt-1 block text-red-700">Deuda {formatoPesos(suDeuda.debe)}</span>
                          ) : null}
                          <button
                            type="button"
                            className="mt-1 block rounded border border-neutral-700 bg-white px-2 py-1"
                            onClick={() => {
                              setFicha(persona);
                              setAbierto(false);
                            }}
                          >
                            Ficha
                          </button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-xs">Tocá un cliente para elegirlo.</p>
            </div>
          </section>
        </div>
      )}

      {alta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-3 pt-10">
          <div className="w-full max-w-xl shadow-xl">
            <CajaClienteForm
              pending={pending}
              aviso={aviso}
              tasasCuota={tasasCuota}
              moraCredito={moraCredito}
              moraCuenta={moraCuenta}
              plazoGeneral={plazoGeneral}
              onCancelar={() => {
                setAlta(false);
                setAviso("");
              }}
              onCrear={crear}
            />
          </div>
        </div>
      )}

      {ficha && (
        <div className="fixed inset-0 z-50 overflow-auto bg-background p-3">
          <CajaFichaCliente
            persona={ficha}
            compras={compras}
            deuda={deudaDe(ficha, deudas)}
            tasasCuota={tasasCuota}
            moraCredito={moraCredito}
            moraCuenta={moraCuenta}
            plazoGeneral={plazoGeneral}
            onVolver={() => setFicha(null)}
            onElegir={() => {
              elegir(ficha);
              setFicha(null);
            }}
            onActualizado={(p) => {
              setFicha(p);
              if (cliente?.id === p.id) onElegir(p);
            }}
          />
        </div>
      )}
    </div>
  );
}
