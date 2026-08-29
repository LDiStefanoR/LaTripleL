"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { enviarPedidoWeb, leerMiPerfil } from "@/app/acciones/pedidos";
import {
  cantidadTotal,
  mensajePedidoWhatsApp,
  subtotalProductos,
} from "@/lib/carrito";
import { avisoEnvio, costoEnvio, etiquetaCostoEnvio } from "@/lib/envio";
import { formatoPesos, nombreVitrina } from "@/lib/format";
import { resumenCombosEnCarrito } from "@/lib/combo";
import {
  avisoCantidadPromo,
  promoCantidadLista,
  totalLineaConPromo,
} from "@/lib/oferta";
import {
  diasParaProgramar,
  proximoTurno,
  textoEntrega,
  textoProximaEntrega,
} from "@/lib/reparto";
import { whatsappUrl } from "@/lib/whatsapp";
import type { PerfilCliente } from "@/types/auth";
import {
  ETIQUETA_FRANJA,
  ETIQUETA_SI_FALTA,
  type ContactoPedido,
  type FranjaReparto,
  type ModoEntrega,
  type SiFaltaProducto,
} from "@/types/pedido";

type PerfilSesion = {
  nombre: string;
  email: string;
  perfil?: PerfilCliente;
};

function contactoCompleto(c: {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
}) {
  return (
    c.nombre.trim().length >= 2 &&
    c.email.includes("@") &&
    c.telefono.replace(/\D/g, "").length >= 8 &&
    c.direccion.trim().length >= 5
  );
}

export function CartDrawer() {
  const sesion = useAuth();
  const { lineas, combos, abierto, cerrar, setCantidad, quitar, vaciar } = useCart();
  const [viaWeb, setViaWeb] = useState(false);
  const [perfil, setPerfil] = useState<PerfilSesion | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modoEntrega, setModoEntrega] = useState<ModoEntrega>("antes_posible");
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [franjaProgramada, setFranjaProgramada] = useState<FranjaReparto | "">("");
  const [siFalta, setSiFalta] = useState<SiFaltaProducto>("reemplazo_misma_marca");
  const [confirmar, setConfirmar] = useState<"web" | "whatsapp" | null>(null);
  const [contactoConfirmar, setContactoConfirmar] = useState<ContactoPedido | null>(null);
  const [pending, start] = useTransition();

  const subtotal = subtotalProductos(lineas, combos);
  const resumen = useMemo(
    () => resumenCombosEnCarrito(lineas, combos),
    [lineas, combos],
  );
  const envio = costoEnvio(subtotal);
  const total = subtotal + envio;
  const unidades = cantidadTotal(lineas);
  const registrado = sesion?.rol === "cliente";
  const asap = useMemo(() => proximoTurno(), [abierto, lineas.length]);
  const dias = useMemo(() => diasParaProgramar(), [abierto, lineas.length]);

  const fechaEntrega =
    modoEntrega === "antes_posible"
      ? asap.iso
      : fechaProgramada || dias[0]?.iso || "";
  const franjasDia = dias.find((d) => d.iso === fechaEntrega)?.franjas ?? [];
  const franja: FranjaReparto | "" =
    modoEntrega === "antes_posible"
      ? asap.franja
      : franjasDia.includes(franjaProgramada as FranjaReparto)
        ? (franjaProgramada as FranjaReparto)
        : (franjasDia[0] ?? "");

  useEffect(() => {
    if (!abierto) {
      setViaWeb(false);
      setMensaje(null);
      setError(null);
      setConfirmar(null);
      return;
    }
    if (sesion?.rol === "cliente") {
      void leerMiPerfil().then(setPerfil);
    } else {
      setPerfil(null);
    }
  }, [abierto, sesion?.email, sesion?.rol]);

  const contactoGuardado: ContactoPedido = {
    nombre: perfil?.nombre ?? sesion?.nombre ?? "",
    email: perfil?.email ?? sesion?.email ?? "",
    telefono: perfil?.perfil?.telefono ?? "",
    direccion: perfil?.perfil?.direccion ?? "",
    horarios:
      franja && fechaEntrega
        ? textoEntrega(modoEntrega, fechaEntrega, franja)
        : "",
  };

  const opcionesListas =
    Boolean(fechaEntrega && franja) &&
    (siFalta === "reemplazo_misma_marca" || siFalta === "omitir");

  const wa =
    lineas.length && opcionesListas && franja
      ? whatsappUrl(
          mensajePedidoWhatsApp(lineas, {
            clienteRegistrado: registrado,
            contacto: registrado ? contactoGuardado : undefined,
            franjaReparto: franja,
            siFaltaProducto: siFalta,
            modoEntrega,
            fechaEntrega,
            combos,
          }),
        )
      : undefined;

  function exigirOpciones() {
    if (opcionesListas) return true;
    setError(
      modoEntrega === "programado"
        ? "Elegí el día y la franja para programar el envío."
        : "Revisá la entrega y qué hacemos si falta un producto.",
    );
    return false;
  }

  function enviarWeb(contacto: ContactoPedido) {
    if (!exigirOpciones() || !franja || !fechaEntrega) return;
    setError(null);
    setMensaje(null);
    start(async () => {
      const resultado = await enviarPedidoWeb(
        lineas,
        {
          ...contacto,
          horarios: textoEntrega(modoEntrega, fechaEntrega, franja),
        },
        {
          franjaReparto: franja,
          siFaltaProducto: siFalta,
          modoEntrega,
          fechaEntrega,
        },
      );
      if (resultado?.error) {
        setError(resultado.error);
        setConfirmar(null);
        return;
      }
      setMensaje(resultado?.ok ?? "Pedido enviado.");
      vaciar();
      setViaWeb(false);
      setConfirmar(null);
      setModoEntrega("antes_posible");
      setFechaProgramada("");
      setFranjaProgramada("");
      setSiFalta("reemplazo_misma_marca");
    });
  }

  function contactoDesdeForm(form: HTMLFormElement): ContactoPedido {
    const data = new FormData(form);
    return {
      nombre: String(data.get("nombre") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      telefono: String(data.get("telefono") ?? "").trim(),
      direccion: String(data.get("direccion") ?? "").trim(),
      horarios: franja && fechaEntrega ? textoEntrega(modoEntrega, fechaEntrega, franja) : "",
    };
  }

  function pedirEnvioWeb(contacto: ContactoPedido) {
    if (!exigirOpciones()) return;
    if (registrado) {
      if (!contactoCompleto(contacto)) {
        setViaWeb(true);
        setError("Revisá domicilio y teléfono antes de enviar.");
        return;
      }
      setContactoConfirmar(contacto);
      setConfirmar("web");
      return;
    }
    if (!contactoCompleto(contacto)) {
      setViaWeb(true);
      setError("Completá tus datos para enviar el pedido por la web.");
      return;
    }
    enviarWeb(contacto);
  }

  function pedirWhatsApp(contacto?: ContactoPedido) {
    if (!exigirOpciones()) return;
    if (registrado) {
      const c = contacto ?? contactoGuardado;
      if (!contactoCompleto(c)) {
        setViaWeb(true);
        setError("Revisá domicilio y teléfono antes de armar el pedido.");
        return;
      }
      setContactoConfirmar(c);
      setConfirmar("whatsapp");
      return;
    }
    if (wa) window.open(wa, "_blank", "noopener,noreferrer");
  }

  if (sesion?.rol === "admin") return null;
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar pedido"
        onClick={cerrar}
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="carrito-titulo"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-4">
          <h2 id="carrito-titulo" className="font-display text-xl font-bold not-italic text-movipack-deep">
            Tu pedido
          </h2>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-neutral-500 hover:bg-neutral-100"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {mensaje && (
            <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {mensaje}
            </p>
          )}
          {lineas.length === 0 && !mensaje ? (
            <p className="mt-8 text-center text-neutral-600">
              Todavía no agregaste productos. Recorré el catálogo y armá la
              lista.
            </p>
          ) : (
            <ul className="space-y-4">
              {lineas.map((linea) => {
                const dato = resumen.porLinea.get(linea.id);
                const bruto = linea.precio * linea.cantidad;
                const neto = dato?.neto ?? totalLineaConPromo(
                  linea.cantidad,
                  linea.precio,
                  linea.tipoPromo,
                );
                const nxm =
                  linea.tipoPromo === "2x1" || linea.tipoPromo === "3x2";
                const hayDto =
                  Boolean(linea.precioLista && linea.precioLista > linea.precio);
                const enCombo = combos.some((c) =>
                  c.productoIds.includes(linea.id),
                );
                const comboLista = (dato?.setsCombo ?? 0) > 0;
                const productoPromo =
                  nxm || (linea.tipoPromo === "precio" && hayDto) || enCombo;
                const aplicada =
                  productoPromo &&
                  (comboLista ||
                    promoCantidadLista(linea.cantidad, linea.tipoPromo));
                const comboPendiente =
                  enCombo &&
                  !comboLista &&
                  `Llevá los ${combos.find((c) => c.productoIds.includes(linea.id))?.productoIds.length ?? 2} juntos para la promo`;
                return (
                <li
                  key={linea.id}
                  className="rounded-xl border border-neutral-200 p-3"
                >
                  <div className="flex flex-wrap gap-1">
                    {productoPromo && (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-900">
                        Producto promo
                      </span>
                    )}
                    {aplicada && (
                      <span className="rounded-md bg-cape px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                        Promo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-neutral-400">
                    Cód. {linea.codigo}
                  </p>
                  <p className="font-semibold leading-snug text-movipack-deep">
                    {nombreVitrina(linea.nombre)}
                  </p>
                  {nxm && !aplicada && (
                    <p className="text-xs font-bold text-cape">
                      {avisoCantidadPromo(linea.tipoPromo)}
                    </p>
                  )}
                  {comboPendiente && (
                    <p className="text-xs font-bold text-cape">{comboPendiente}</p>
                  )}
                  <div className="mt-1 text-sm text-neutral-600">
                    {hayDto ? (
                      <div className="flex flex-wrap items-baseline gap-1.5">
                        <p className="font-extrabold text-cape">
                          {formatoPesos(linea.precio)} c/u
                        </p>
                        <p className="text-sm font-semibold text-neutral-400 line-through">
                          {formatoPesos(linea.precioLista ?? 0)}
                        </p>
                      </div>
                    ) : (
                      <p>{formatoPesos(linea.precio)} c/u</p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 font-bold"
                        onClick={() => setCantidad(linea.id, linea.cantidad - 1)}
                        aria-label="Quitar uno"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center font-bold">
                        {linea.cantidad}
                      </span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 font-bold"
                        onClick={() => setCantidad(linea.id, linea.cantidad + 1)}
                        aria-label="Agregar uno"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      {aplicada && neto < bruto ? (
                        <>
                          <p className="text-xs font-semibold text-neutral-400 line-through">
                            {formatoPesos(bruto)}
                          </p>
                          <p className="font-bold text-cape">
                            {formatoPesos(neto)}
                          </p>
                        </>
                      ) : (
                        <p className="font-bold text-movipack-deep">
                          {formatoPesos(neto)}
                        </p>
                      )}
                      <button
                        type="button"
                        className="text-xs font-semibold text-cape hover:underline"
                        onClick={() => quitar(linea.id)}
                      >
                        Sacar
                      </button>
                    </div>
                  </div>
                </li>
                );
              })}
              {lineas.length > 0 && (
                <li className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                    Envío
                  </p>
                  <p className="font-bold text-movipack-deep">
                    {etiquetaCostoEnvio(envio)}
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold italic text-cape">
                    {envio > 0 ? formatoPesos(envio) : "Sin cargo"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-neutral-600">
                    {avisoEnvio(subtotal)}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Menos de $15.000: $5.998 · menos de $30.000: $4.890 · hasta
                    $60.000: $4.000 · más de $60.000: sin cargo.
                  </p>
                </li>
              )}
            </ul>
          )}
        </div>

        {lineas.length > 0 && (
          <div className="max-h-[62%] overflow-y-auto border-t border-neutral-200 p-4">
            <div className="space-y-1 text-sm">
              <p className="flex justify-between text-neutral-600">
                <span>
                  {unidades} artículo{unidades === 1 ? "" : "s"}
                </span>
                <span>{formatoPesos(subtotal)}</span>
              </p>
              <p className="flex justify-between text-base font-bold text-movipack-deep">
                <span>Total</span>
                <span>{formatoPesos(total)}</span>
              </p>
            </div>

            <div className="mt-3">
              <OpcionesPedido
                modo={modoEntrega}
                fecha={fechaEntrega}
                franja={franja}
                siFalta={siFalta}
                dias={dias}
                asapLabel={textoProximaEntrega(asap)}
                onModo={(v) => {
                  setModoEntrega(v);
                  setError(null);
                  if (v === "programado" && !fechaProgramada && dias[0]) {
                    setFechaProgramada(dias[0].iso);
                    setFranjaProgramada(dias[0].franjas[0] ?? "manana");
                  }
                }}
                onFecha={(v) => {
                  setFechaProgramada(v);
                  const dia = dias.find((d) => d.iso === v);
                  if (dia && !dia.franjas.includes(franjaProgramada as FranjaReparto)) {
                    setFranjaProgramada(dia.franjas[0] ?? "");
                  }
                  setError(null);
                }}
                onFranja={(v) => {
                  setFranjaProgramada(v);
                  setError(null);
                }}
                onSiFalta={(v) => {
                  setSiFalta(v);
                  setError(null);
                }}
              />
            </div>

            {viaWeb && (
              <form
                className="mt-3 space-y-3 rounded-xl border border-movipack/20 bg-[#fff6ea] p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  pedirEnvioWeb(contactoDesdeForm(e.currentTarget));
                }}
              >
                <p className="text-sm font-bold text-movipack-deep">
                  {registrado ? "Revisá tus datos de envío" : "Tus datos para el envío"}
                </p>
                <Campo nombre="nombre" etiqueta="Nombre" required defaultValue={contactoGuardado.nombre} />
                <Campo nombre="direccion" etiqueta="Domicilio" required defaultValue={contactoGuardado.direccion} />
                <Campo nombre="telefono" etiqueta="Teléfono" required defaultValue={contactoGuardado.telefono} />
                <Campo
                  nombre="email"
                  etiqueta="Mail"
                  type="email"
                  required
                  defaultValue={contactoGuardado.email}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-xl bg-cape px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {registrado ? "Revisar y enviar" : "Enviar pedido por la web"}
                </button>
              </form>
            )}

            {error && (
              <p className="mt-2 text-sm font-semibold text-cape">{error}</p>
            )}

            {!viaWeb && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (registrado && contactoCompleto(contactoGuardado)) {
                      pedirEnvioWeb(contactoGuardado);
                    } else {
                      if (!exigirOpciones()) return;
                      setViaWeb(true);
                      setError(null);
                    }
                  }}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-cape px-6 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition hover:brightness-110 disabled:opacity-60"
                >
                  Enviar pedido por la web
                </button>
                <button
                  type="button"
                  onClick={() => pedirWhatsApp()}
                  className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-2xl border border-neutral-300 px-6 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
                >
                  Crear pedido WhatsApp
                </button>
              </>
            )}
            <button
              type="button"
              onClick={vaciar}
              className="mt-3 w-full text-center text-sm font-semibold text-neutral-500 hover:text-cape"
            >
              Vaciar lista
            </button>
          </div>
        )}

        {confirmar && contactoConfirmar && franja && fechaEntrega && (
          <div className="absolute inset-0 z-10 flex items-end bg-black/40 p-4 sm:items-center">
            <div className="max-h-full w-full overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
              <p className="text-sm font-bold text-movipack-deep">
                ¿Estás seguro que deseás enviar el pedido?
              </p>
              <dl className="mt-3 space-y-1.5 text-sm text-neutral-700">
                <Dato etiqueta="Nombre" valor={contactoConfirmar.nombre} />
                <Dato etiqueta="Domicilio" valor={contactoConfirmar.direccion} />
                <Dato etiqueta="Teléfono" valor={contactoConfirmar.telefono} />
                <Dato etiqueta="Mail" valor={contactoConfirmar.email} />
                <Dato
                  etiqueta="Entrega"
                  valor={textoEntrega(modoEntrega, fechaEntrega, franja)}
                />
                <Dato etiqueta="Si falta un producto" valor={ETIQUETA_SI_FALTA[siFalta]} />
                <Dato etiqueta="Productos" valor={formatoPesos(subtotal)} />
                <Dato
                  etiqueta="Envío"
                  valor={envio > 0 ? formatoPesos(envio) : "Sin cargo"}
                />
                <Dato etiqueta="Total" valor={formatoPesos(total)} />
              </dl>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-xl bg-cape px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  onClick={() => {
                    if (confirmar === "web") {
                      enviarWeb(contactoConfirmar);
                      return;
                    }
                    const href =
                      franja &&
                      whatsappUrl(
                        mensajePedidoWhatsApp(lineas, {
                          clienteRegistrado: true,
                          contacto: contactoConfirmar,
                          franjaReparto: franja,
                          siFaltaProducto: siFalta,
                          modoEntrega,
                          fechaEntrega,
                          combos,
                        }),
                      );
                    setConfirmar(null);
                    if (href) window.open(href, "_blank", "noopener,noreferrer");
                  }}
                >
                  {pending
                    ? "Enviando…"
                    : confirmar === "web"
                      ? "Sí, enviar el pedido"
                      : "Sí, crear pedido WhatsApp"}
                </button>
                <button
                  type="button"
                  className="text-sm font-semibold text-neutral-500"
                  onClick={() => setConfirmar(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-neutral-500">{etiqueta}</dt>
      <dd className="font-semibold text-movipack-deep">{valor}</dd>
    </div>
  );
}

function OpcionesPedido({
  modo,
  fecha,
  franja,
  siFalta,
  dias,
  asapLabel,
  onModo,
  onFecha,
  onFranja,
  onSiFalta,
}: {
  modo: ModoEntrega;
  fecha: string;
  franja: FranjaReparto | "";
  siFalta: SiFaltaProducto;
  dias: ReturnType<typeof diasParaProgramar>;
  asapLabel: string;
  onModo: (v: ModoEntrega) => void;
  onFecha: (v: string) => void;
  onFranja: (v: FranjaReparto) => void;
  onSiFalta: (v: SiFaltaProducto) => void;
}) {
  const dia = dias.find((d) => d.iso === fecha);
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-xs font-bold text-movipack-deep">
          ¿En qué franja querés que llegue?
        </legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <OpcionRadio
            name="modoEntrega"
            checked={modo === "antes_posible"}
            onChange={() => onModo("antes_posible")}
            titulo="Lo antes posible"
            detalle={asapLabel}
          />
          <OpcionRadio
            name="modoEntrega"
            checked={modo === "programado"}
            onChange={() => onModo("programado")}
            titulo="Programar envío"
            detalle="Elegí día y franja"
          />
        </div>
      </fieldset>
      {modo === "programado" && (
        <div className="space-y-2 rounded-xl bg-neutral-50 p-3">
          <label className="block text-xs font-bold text-movipack-deep">
            Día de entrega
            <select
              value={fecha}
              onChange={(e) => onFecha(e.target.value)}
              className="mt-1 w-full rounded-lg border border-movipack/20 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-movipack"
            >
              {dias.map((d) => (
                <option key={d.iso} value={d.iso}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="text-xs font-bold text-movipack-deep">
              Franja
            </legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(dia?.franjas ?? []).map((f) => (
                <OpcionRadio
                  key={f}
                  name="franjaProgramada"
                  checked={franja === f}
                  onChange={() => onFranja(f)}
                  titulo={f === "manana" ? "Mañana" : "Tarde"}
                  detalle={ETIQUETA_FRANJA[f]}
                />
              ))}
            </div>
            {dia && dia.franjas.length === 1 && (
              <p className="mt-1 text-[11px] text-neutral-500">
                Los domingos el local cierra a las 14, solo hay franja de mañana.
              </p>
            )}
          </fieldset>
        </div>
      )}
      <fieldset>
        <legend className="text-xs font-bold text-movipack-deep">
          Si no hay stock de algún producto
        </legend>
        <div className="mt-1.5 space-y-2">
          <OpcionRadio
            name="siFaltaProducto"
            checked={siFalta === "reemplazo_misma_marca"}
            onChange={() => onSiFalta("reemplazo_misma_marca")}
            titulo={ETIQUETA_SI_FALTA.reemplazo_misma_marca}
          />
          <OpcionRadio
            name="siFaltaProducto"
            checked={siFalta === "omitir"}
            onChange={() => onSiFalta("omitir")}
            titulo={ETIQUETA_SI_FALTA.omitir}
          />
        </div>
      </fieldset>
    </div>
  );
}

function OpcionRadio({
  name,
  checked,
  onChange,
  titulo,
  detalle,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  titulo: string;
  detalle?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
        checked
          ? "border-movipack bg-movipack/10"
          : "border-neutral-200 bg-white"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5"
      />
      <span>
        <span className="block font-bold leading-snug text-movipack-deep">
          {titulo}
        </span>
        {detalle ? (
          <span className="block text-xs font-medium text-neutral-600">
            {detalle}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function Campo({
  nombre,
  etiqueta,
  defaultValue,
  required,
  type = "text",
}: {
  nombre: string;
  etiqueta: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-neutral-600">
      {etiqueta}
      <input
        name={nombre}
        type={type}
        required={required}
        defaultValue={defaultValue}
        key={`${nombre}-${defaultValue ?? ""}`}
        className="mt-1 w-full rounded-lg border border-movipack/20 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-movipack"
      />
    </label>
  );
}
