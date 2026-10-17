"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { leerDatosLocal } from "@/app/acciones/local";
import { enviarPedidoWeb, leerMiPerfil } from "@/app/acciones/pedidos";
import { datosLocalDesde, type DatosLocal } from "@/lib/datos-local";
import {
  cantidadTotal,
  mensajePedidoWhatsApp,
  subtotalProductos,
} from "@/lib/carrito";
import { avisoEnvio, costoEnvio } from "@/lib/envio";
import type { EscalaEnvio } from "@/types/ajustes";
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
  ETIQUETA_PAGO_PEDIDO,
  type ContactoPedido,
  type FormaPagoPedido,
  type FranjaReparto,
  type ModoEntrega,
} from "@/types/pedido";

type ReciboPedido = {
  entrega: string;
  forma: FormaPagoPedido;
  transferencia: number;
  cuentaCorriente: number;
  total: number;
};

type PerfilSesion = {
  nombre: string;
  email: string;
  perfil?: PerfilCliente;
  direcciones: string[];
  cuenta: { habilitada: boolean; disponible: number; saldo: number };
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

export function CartDrawer({ envio }: { envio: EscalaEnvio }) {
  const sesion = useAuth();
  const { lineas, combos, abierto, cerrar, setCantidad, quitar, vaciar } = useCart();
  const [perfil, setPerfil] = useState<PerfilSesion | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modoEntrega, setModoEntrega] = useState<ModoEntrega>("antes_posible");
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [franjaProgramada, setFranjaProgramada] = useState<FranjaReparto | "">("");
  const [confirmar, setConfirmar] = useState<"web" | "whatsapp" | null>(null);
  const [formaPago, setFormaPago] = useState<FormaPagoPedido>("transferencia");
  const [montoCuenta, setMontoCuenta] = useState("");
  const [direccionPedido, setDireccionPedido] = useState("");
  const [contactoConfirmar, setContactoConfirmar] = useState<ContactoPedido | null>(null);
  const [local, setLocal] = useState<DatosLocal | null>(null);
  const [recibo, setRecibo] = useState<ReciboPedido | null>(null);
  const [pending, start] = useTransition();

  const subtotal = subtotalProductos(lineas, combos);
  const resumen = useMemo(
    () => resumenCombosEnCarrito(lineas, combos),
    [lineas, combos],
  );
  const costo = costoEnvio(subtotal, envio);
  const total = subtotal + costo;
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
      setMensaje(null);
      setError(null);
      setConfirmar(null);
      setRecibo(null);
      return;
    }
    void leerDatosLocal().then(setLocal);
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

  const opcionesListas = Boolean(fechaEntrega && franja);
  const cuenta = perfil?.cuenta ?? { habilitada: false, disponible: 0, saldo: 0 };
  const direcciones = perfil?.direcciones ?? [];
  const puedeCuenta = cuenta.habilitada && cuenta.disponible >= total && total > 0;
  const puedeMixto = cuenta.habilitada && cuenta.disponible > 0 && total > 1;
  const puedeSaldo = cuenta.saldo >= total && total > 0;
  const puedeSaldoParcial = cuenta.saldo > 0 && cuenta.saldo < total;
  const datosLocal = local ?? datosLocalDesde(null);
  const ahorro = useMemo(() => {
    let cliente = 0;
    let promos = 0;
    for (const linea of lineas) {
      const listaUnit = linea.precioLista ?? linea.precio;
      const lista = listaUnit * linea.cantidad;
      const neto =
        resumen.porLinea.get(linea.id)?.neto ?? linea.precio * linea.cantidad;
      let dtoCliente = 0;
      if (
        registrado &&
        linea.descuentoCliente &&
        listaUnit > linea.precio
      ) {
        const precioCliente = Math.round(
          listaUnit * (1 - linea.descuentoCliente / 100),
        );
        if (linea.precio >= precioCliente - 1) {
          dtoCliente = (listaUnit - linea.precio) * linea.cantidad;
        }
      }
      cliente += dtoCliente;
      promos += Math.max(0, lista - neto - dtoCliente);
    }
    return { cliente, promos };
  }, [lineas, resumen, registrado]);

  const wa =
    lineas.length && opcionesListas && franja
      ? whatsappUrl(
          mensajePedidoWhatsApp(lineas, {
            clienteRegistrado: registrado,
            contacto: registrado ? contactoGuardado : undefined,
            franjaReparto: franja,
            modoEntrega,
            fechaEntrega,
            combos,
            envio,
          }),
        )
      : undefined;

  function exigirOpciones() {
    if (opcionesListas) return true;
    setError(
      modoEntrega === "programado"
        ? "Elegí el día y la franja para programar el envío."
        : "Revisá el día y la franja de entrega.",
    );
    return false;
  }

  function pagoElegido() {
    if (formaPago === "cuenta_corriente") {
      if (!puedeCuenta) {
        setError("La cuenta corriente no alcanza para este pedido.");
        return null;
      }
      return { forma: "cuenta_corriente" as const, cuentaCorriente: total };
    }
    if (formaPago === "saldo") {
      if (!puedeSaldo) {
        setError("El saldo no alcanza para este pedido.");
        return null;
      }
      return { forma: "saldo" as const, cuentaCorriente: 0 };
    }
    if (formaPago === "saldo_transferencia") {
      if (!puedeSaldoParcial) {
        setError("El saldo tiene que cubrir una parte del pedido.");
        return null;
      }
      return { forma: "saldo_transferencia" as const, cuentaCorriente: 0 };
    }
    if (formaPago === "mixto") {
      const cc = Math.round(Number(montoCuenta.replace(/\D/g, ""))) || 0;
      if (!puedeMixto || cc < 1 || cc > cuenta.disponible || cc >= total) {
        setError("Indicá cuánto va a cuenta corriente. El resto se paga por transferencia.");
        return null;
      }
      return { forma: "mixto" as const, cuentaCorriente: cc };
    }
    return { forma: "transferencia" as const, cuentaCorriente: 0 };
  }

  function enviarWeb(
    contacto: ContactoPedido,
    pago: { forma: FormaPagoPedido; cuentaCorriente: number },
  ) {
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
          modoEntrega,
          fechaEntrega,
          pago,
        },
      );
      if (resultado?.error) {
        setError(resultado.error);
        setConfirmar(null);
        return;
      }
      const transferencia =
        pago.forma === "saldo"
          ? 0
          : pago.forma === "saldo_transferencia"
            ? Math.max(0, total - cuenta.saldo)
            : Math.max(0, total - pago.cuentaCorriente);
      setRecibo({
        entrega:
          modoEntrega === "antes_posible"
            ? `lo antes posible, generalmente ${datosLocal.demoraEntrega}`
            : textoEntrega(modoEntrega, fechaEntrega, franja),
        forma: pago.forma,
        transferencia,
        cuentaCorriente: pago.cuentaCorriente,
        total,
      });
      setMensaje(null);
      vaciar();
      setConfirmar(null);
      setModoEntrega("antes_posible");
      setFechaProgramada("");
      setFranjaProgramada("");
      setFormaPago("transferencia");
      setMontoCuenta("");
    });
  }

  function pedirEnvioWeb(contacto: ContactoPedido) {
    if (!exigirOpciones()) return;
    if (registrado) {
      if (!contactoCompleto(contacto)) {
        setError("Revisá domicilio y teléfono antes de enviar.");
        return;
      }
      setContactoConfirmar(contacto);
      setDireccionPedido(contacto.direccion);
      setFormaPago("transferencia");
      setMontoCuenta(
        cuenta.disponible > 0 && cuenta.disponible < total ? String(cuenta.disponible) : "",
      );
      setConfirmar("web");
      return;
    }
    if (!contactoCompleto(contacto)) {
      setError("Completá tus datos para enviar el pedido por la web.");
      return;
    }
    setContactoConfirmar(contacto);
    setDireccionPedido(contacto.direccion);
    setFormaPago("transferencia");
    setConfirmar("web");
  }

  function pedirWhatsApp(contacto?: ContactoPedido) {
    if (!exigirOpciones()) return;
    if (registrado) {
      const c = contacto ?? contactoGuardado;
      if (!contactoCompleto(c)) {
        setError("Revisá domicilio y teléfono antes de armar el pedido.");
        return;
      }
      setContactoConfirmar(c);
      setDireccionPedido(c.direccion);
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

        <div className="min-h-0 flex-[1.35] overflow-y-auto px-4 py-4">
          {recibo && (
            <ReciboEnviado recibo={recibo} datos={datosLocal} />
          )}
          {mensaje && (
            <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {mensaje}
            </p>
          )}
          {lineas.length === 0 && !mensaje && !recibo ? (
            <p className="mt-8 text-center text-neutral-600">
              Todavía no agregaste productos. Recorré el catálogo y armá la
              lista.
            </p>
          ) : lineas.length > 0 ? (
            <ul className="space-y-3">
              {(ahorro.cliente > 0 || ahorro.promos > 0) && (
                <li className="rounded-2xl bg-emerald-50 px-4 py-3">
                  {ahorro.cliente > 0 && (
                    <p className="text-sm font-bold text-emerald-800">
                      Te estás ahorrando {formatoPesos(ahorro.cliente)} por ser cliente.
                    </p>
                  )}
                  {ahorro.promos > 0 && (
                    <p className={`text-sm font-semibold text-emerald-800 ${ahorro.cliente > 0 ? "mt-1" : ""}`}>
                      {ahorro.cliente > 0 ? "Y " : "Te estás ahorrando "}
                      {formatoPesos(ahorro.promos)} en promos.
                    </p>
                  )}
                </li>
              )}
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
                  className="rounded-2xl border border-neutral-200 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-snug text-movipack-deep">
                        {nombreVitrina(linea.nombre)}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Cód. {linea.codigo}
                        {productoPromo ? " · Promo" : ""}
                      </p>
                      <p className="mt-1 text-sm">
                        <span className={hayDto ? "font-bold text-cape" : "text-neutral-700"}>
                          {formatoPesos(linea.precio)}
                        </span>
                        {hayDto && (
                          <span className="ml-1.5 text-neutral-400 line-through">
                            {formatoPesos(linea.precioLista ?? 0)}
                          </span>
                        )}
                      </p>
                      {nxm && !aplicada && (
                        <p className="text-xs font-bold text-cape">
                          {avisoCantidadPromo(linea.tipoPromo)}
                        </p>
                      )}
                      {comboPendiente && (
                        <p className="text-xs font-bold text-cape">{comboPendiente}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {aplicada && neto < bruto && (
                        <p className="text-xs text-neutral-400 line-through">{formatoPesos(bruto)}</p>
                      )}
                      <p className="font-bold text-movipack-deep">{formatoPesos(neto)}</p>
                      <button
                        type="button"
                        className="text-xs font-semibold text-cape hover:underline"
                        onClick={() => quitar(linea.id)}
                      >
                        Sacar
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 font-bold"
                      onClick={() => setCantidad(linea.id, linea.cantidad - 1)}
                      aria-label="Quitar uno"
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center font-bold">{linea.cantidad}</span>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 font-bold"
                      onClick={() => setCantidad(linea.id, linea.cantidad + 1)}
                      aria-label="Agregar uno"
                    >
                      +
                    </button>
                  </div>
                </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {lineas.length > 0 && (
          <div className="max-h-[38%] min-h-0 shrink-0 overflow-y-auto border-t border-neutral-200 p-4">
            <div className="space-y-1 text-sm">
              <p className="flex justify-between text-neutral-600">
                <span>
                  {unidades} artículo{unidades === 1 ? "" : "s"}
                </span>
                <span>{formatoPesos(subtotal)}</span>
              </p>
              <p className="flex justify-between text-neutral-600">
                <span>Envío</span>
                <span>{costo > 0 ? formatoPesos(costo) : "Sin cargo"}</span>
              </p>
              <p className="text-xs text-neutral-500">{avisoEnvio(subtotal, envio)}</p>
              {ahorro.cliente > 0 && (
                <p className="text-sm font-bold text-emerald-700">
                  Ahorro por ser cliente: {formatoPesos(ahorro.cliente)}
                </p>
              )}
              <p className="flex justify-between text-base font-bold text-movipack-deep">
                <span>Total</span>
                <span>{formatoPesos(total)}</span>
              </p>
            </div>

            {error && !confirmar && (
              <p className="mt-2 text-sm font-semibold text-cape">{error}</p>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (registrado && contactoCompleto(contactoGuardado)) {
                  pedirEnvioWeb(contactoGuardado);
                } else {
                  setError(null);
                  setConfirmar("web");
                  setContactoConfirmar(contactoGuardado);
                  setDireccionPedido(contactoGuardado.direccion);
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
              <div className="mt-3">
                <OpcionesPedido
                  modo={modoEntrega}
                  fecha={fechaEntrega}
                  franja={franja}
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
                />
              </div>
              <div className="mt-3 space-y-2">
                <CampoControl
                  etiqueta="Nombre"
                  valor={contactoConfirmar.nombre}
                  onChange={(nombre) =>
                    setContactoConfirmar({ ...contactoConfirmar, nombre })
                  }
                />
                <CampoControl
                  etiqueta="Teléfono"
                  valor={contactoConfirmar.telefono}
                  onChange={(telefono) =>
                    setContactoConfirmar({ ...contactoConfirmar, telefono })
                  }
                />
                <CampoControl
                  etiqueta="Mail"
                  type="email"
                  valor={contactoConfirmar.email}
                  onChange={(email) =>
                    setContactoConfirmar({ ...contactoConfirmar, email })
                  }
                />
              </div>
              <dl className="mt-3 space-y-1.5 text-sm text-neutral-700">
                <Dato
                  etiqueta="Entrega"
                  valor={textoEntrega(modoEntrega, fechaEntrega, franja)}
                />
                <Dato etiqueta="Productos" valor={formatoPesos(subtotal)} />
                <Dato
                  etiqueta="Envío"
                  valor={costo > 0 ? formatoPesos(costo) : "Sin cargo"}
                />
                <Dato etiqueta="Total" valor={formatoPesos(total)} />
              </dl>
              <label className="mt-4 block text-xs font-bold text-movipack-deep">
                Dirección de entrega
                <input
                  value={direccionPedido}
                  onChange={(e) => setDireccionPedido(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold outline-none focus:border-movipack"
                />
              </label>
              {direcciones.filter((d) => d.trim().toLowerCase() !== direccionPedido.trim().toLowerCase()).length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {direcciones
                    .filter((d) => d.trim().toLowerCase() !== direccionPedido.trim().toLowerCase())
                    .map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm font-semibold text-neutral-700"
                        onClick={() => setDireccionPedido(d)}
                      >
                        {d}
                      </button>
                    ))}
                </div>
              )}
              {confirmar === "web" && (
                <fieldset className="mt-4 space-y-2">
                  <legend className="text-xs font-bold text-movipack-deep">¿Cómo abonás?</legend>
                  {puedeSaldo && (
                    <OpcionRadio
                      name="formaPago"
                      checked={formaPago === "saldo"}
                      onChange={() => setFormaPago("saldo")}
                      titulo={ETIQUETA_PAGO_PEDIDO.saldo}
                      detalle={`Tenés ${formatoPesos(cuenta.saldo)}. Cubre este pedido.`}
                    />
                  )}
                  {puedeSaldoParcial && (
                    <OpcionRadio
                      name="formaPago"
                      checked={formaPago === "saldo_transferencia"}
                      onChange={() => setFormaPago("saldo_transferencia")}
                      titulo={ETIQUETA_PAGO_PEDIDO.saldo_transferencia}
                      detalle={`Usamos ${formatoPesos(cuenta.saldo)} de tu saldo. El resto, ${formatoPesos(total - cuenta.saldo)}, por transferencia.`}
                    />
                  )}
                  <OpcionRadio
                    name="formaPago"
                    checked={formaPago === "transferencia"}
                    onChange={() => setFormaPago("transferencia")}
                    titulo={ETIQUETA_PAGO_PEDIDO.transferencia}
                    detalle="Se despacha solo cuando pagás. No hace falta mandar el comprobante."
                  />
                  {puedeCuenta && (
                    <OpcionRadio
                      name="formaPago"
                      checked={formaPago === "cuenta_corriente"}
                      onChange={() => setFormaPago("cuenta_corriente")}
                      titulo={ETIQUETA_PAGO_PEDIDO.cuenta_corriente}
                      detalle={`Disponible ${formatoPesos(cuenta.disponible)}. Cubre este pedido.`}
                    />
                  )}
                  {puedeMixto && (
                    <OpcionRadio
                      name="formaPago"
                      checked={formaPago === "mixto"}
                      onChange={() => {
                        setFormaPago("mixto");
                        if (!montoCuenta) {
                          setMontoCuenta(String(Math.min(cuenta.disponible, total - 1)));
                        }
                      }}
                      titulo={ETIQUETA_PAGO_PEDIDO.mixto}
                      detalle={`Hasta ${formatoPesos(Math.min(cuenta.disponible, total - 1))} en cuenta corriente. El resto, transferencia.`}
                    />
                  )}
                  {cuenta.habilitada && !puedeCuenta && cuenta.disponible <= 0 && (
                    <p className="text-xs font-semibold text-neutral-500">
                      Tu cuenta corriente no tiene disponible para este pedido.
                    </p>
                  )}
                  {formaPago === "mixto" && (
                    <label className="block text-xs font-bold text-neutral-600">
                      Cuánto va a cuenta corriente
                      <input
                        inputMode="numeric"
                        value={montoCuenta}
                        onChange={(e) => setMontoCuenta(e.target.value.replace(/[^\d]/g, ""))}
                        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold outline-none focus:border-movipack"
                      />
                    </label>
                  )}
                  {(formaPago === "transferencia" || formaPago === "mixto" || formaPago === "saldo_transferencia") && (
                    <AvisoTransferencia
                      datos={datosLocal}
                      monto={
                        formaPago === "mixto"
                          ? Math.max(0, total - (Math.round(Number(montoCuenta.replace(/\D/g, ""))) || 0))
                          : formaPago === "saldo_transferencia"
                            ? Math.max(0, total - cuenta.saldo)
                            : total
                      }
                      entrega={
                        modoEntrega === "antes_posible"
                          ? `lo antes posible, generalmente ${datosLocal.demoraEntrega}`
                          : textoEntrega(modoEntrega, fechaEntrega, franja)
                      }
                    />
                  )}
                </fieldset>
              )}
              {error && <p className="mt-3 text-sm font-semibold text-cape">{error}</p>}
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-xl bg-cape px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  onClick={() => {
                    const contacto = { ...contactoConfirmar, direccion: direccionPedido.trim() };
                    if (!contactoCompleto(contacto)) {
                      setError("Completá nombre, mail, teléfono y una dirección.");
                      return;
                    }
                    if (!exigirOpciones()) return;
                    if (confirmar === "web") {
                      const pago = pagoElegido();
                      if (!pago) return;
                      enviarWeb(contacto, pago);
                      return;
                    }
                    const href =
                      franja &&
                      whatsappUrl(
                        mensajePedidoWhatsApp(lineas, {
                          clienteRegistrado: true,
                          contacto,
                          franjaReparto: franja,
                          modoEntrega,
                          fechaEntrega,
                          combos,
                          envio,
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

function AvisoTransferencia({
  datos,
  monto,
  entrega,
  recibido,
  compacto,
}: {
  datos: DatosLocal;
  monto: number;
  entrega: string;
  recibido?: boolean;
  compacto?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[#f4f4f5] p-3 text-sm text-neutral-800">
      {!compacto && (
        <p className="font-semibold text-neutral-950">
          {recibido
            ? `El local recibió tu pedido y lo está procesando para que te llegue ${entrega}.`
            : `Te llega ${entrega}.`}
        </p>
      )}
      <p className="mt-2">
        Transferí {formatoPesos(monto)}
        {datos.titular ? ` a nombre de ${datos.titular}` : ""}. Una vez que pagues, se despacha
        automáticamente. No hace falta que mandes el comprobante.
      </p>
      {datos.alias ? (
        <DatoCopiable etiqueta="Alias" valor={datos.alias} />
      ) : null}
      {datos.cbu ? <DatoCopiable etiqueta="CBU" valor={datos.cbu} /> : null}
      {!datos.alias && !datos.cbu && (
        <p className="mt-2 text-xs font-semibold text-neutral-500">
          El local todavía no cargó el alias. Si no aparece, pedilo por WhatsApp.
        </p>
      )}
    </div>
  );
}

function DatoCopiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <p className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
      <span>
        <span className="block text-[11px] font-bold uppercase tracking-wide text-neutral-500">
          {etiqueta}
        </span>
        <span className="font-semibold text-neutral-950">{valor}</span>
      </span>
      <button
        type="button"
        className="shrink-0 text-xs font-bold text-[#009ee3]"
        onClick={() => {
          void navigator.clipboard.writeText(valor).then(() => {
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 1500);
          });
        }}
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </p>
  );
}

function ReciboEnviado({
  recibo,
  datos,
}: {
  recibo: ReciboPedido;
  datos: DatosLocal;
}) {
  const conTransferencia = recibo.transferencia > 0;
  return (
    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-base font-bold text-emerald-950">
        El local recibió tu pedido y lo está procesando para que te llegue {recibo.entrega}.
      </p>
      {(recibo.forma === "saldo" || recibo.forma === "saldo_transferencia") && (
        <p className="mt-2 text-sm font-semibold text-emerald-900">
          {recibo.forma === "saldo"
            ? "Se descontó de tu saldo a cuenta."
            : `Usamos tu saldo y el resto, ${formatoPesos(recibo.transferencia)}, queda para transferir.`}
        </p>
      )}
      {recibo.cuentaCorriente > 0 && (
        <p className="mt-2 text-sm font-semibold text-emerald-900">
          {formatoPesos(recibo.cuentaCorriente)} quedaron en tu cuenta corriente.
        </p>
      )}
      {conTransferencia ? (
        <div className="mt-3">
          <AvisoTransferencia
            datos={datos}
            monto={recibo.transferencia}
            entrega={recibo.entrega}
            compacto
          />
        </div>
      ) : (
        <p className="mt-2 text-sm text-emerald-900">
          Lo vas a ver en Mi perfil, con el estado en el que está.
        </p>
      )}
    </div>
  );
}

function CampoControl({
  etiqueta,
  valor,
  onChange,
  type = "text",
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs font-bold text-movipack-deep">
      {etiqueta}
      <input
        type={type}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold outline-none focus:border-movipack"
      />
    </label>
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
  dias,
  asapLabel,
  onModo,
  onFecha,
  onFranja,
}: {
  modo: ModoEntrega;
  fecha: string;
  franja: FranjaReparto | "";
  dias: ReturnType<typeof diasParaProgramar>;
  asapLabel: string;
  onModo: (v: ModoEntrega) => void;
  onFecha: (v: string) => void;
  onFranja: (v: FranjaReparto) => void;
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
