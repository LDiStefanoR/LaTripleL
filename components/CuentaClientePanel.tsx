"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  clienteActualizarPerfil,
  clienteCambiarClave,
  clienteGuardarAlias,
  clienteInformarPago,
  clienteSolicitarEfectivo,
  type EstadoCuentaCliente,
} from "@/app/acciones/cuenta-cliente";
import { useCart } from "@/components/CartProvider";
import { whatsappUrl } from "@/lib/whatsapp";
import { formatoFecha, formatoPesos, nombreVitrina } from "@/lib/format";
import {
  AVISO_INTERES,
  ETIQUETA_COBRO,
  estadoCobroTicket,
  interesDeTicket,
  interesTotalDeuda,
  numeroVisibleTicket,
  semaforoDeuda,
  vencimientoDeTicket,
} from "@/lib/deuda";
import {
  DETALLE_TIPO_CUENTA,
  ETIQUETA_TIPO_CUENTA,
  parseTipoCuenta,
  tieneCreditoSuper,
  tieneLineaCredito,
  veDescuentos,
} from "@/lib/tipo-cuenta";
import type { UsuarioPublico } from "@/types/auth";
import type { AjustesCuenta, ResumenCliente, TicketDeuda } from "@/types/cuenta";
import { ETIQUETA_FRANJA, ETIQUETA_SI_FALTA, type Pedido } from "@/types/pedido";

const FOTO_DEFAULT = "/recursos/logo.jpg";

const ESTADO_PEDIDO: Record<Pedido["estado"], string> = {
  sin_atender: "Recibido",
  en_proceso: "En proceso",
  terminado: "Entregado",
};

function FotoPerfil({
  src,
  nombre,
  onPick,
}: {
  src: string;
  nombre: string;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative h-36 w-36 overflow-hidden rounded-full bg-white shadow-lg ring-4 ring-white"
        aria-label="Cambiar foto de perfil"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src || FOTO_DEFAULT}
          alt={nombre}
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-white">
          Editar
        </span>
      </button>
      <input
        ref={input}
        name="foto"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

function TicketFila({ ticket }: { ticket: TicketDeuda }) {
  const cobro = estadoCobroTicket(ticket);
  const vto = vencimientoDeTicket(ticket);
  const interes = interesDeTicket(ticket);
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 border-t border-white/20 py-3 first:border-t-0">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">
          {ticket.origen === "web" ? "Pedido web" : "Ticket de tienda"} ·{" "}
          {numeroVisibleTicket(ticket)}
        </p>
        <p className="mt-0.5 text-sm font-semibold">
          {ETIQUETA_COBRO[cobro]} · vence {formatoFecha(vto)}
        </p>
        {interes.interes > 0 && (
          <p className="text-xs font-semibold">
            Intereses por mora {Math.round(interes.tasa * 100)}% ·{" "}
            {formatoPesos(interes.interes)}
          </p>
        )}
        {ticket.adjunto ? (
          <a
            href={ticket.adjunto}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold underline"
          >
            Descargar factura
          </a>
        ) : ticket.origen !== "web" ? (
          <p className="text-xs opacity-80">
            Cuando el local adjunte la factura, la vas a poder bajar acá.
          </p>
        ) : null}
      </div>
      <p className="text-sm font-bold">
        {formatoPesos(ticket.debe + interes.interes)}
      </p>
    </li>
  );
}

export function CuentaClientePanel({
  usuario,
  resumen,
  ajustes,
  pedidos,
}: {
  usuario: UsuarioPublico;
  resumen: ResumenCliente | null;
  ajustes: AjustesCuenta;
  pedidos: Pedido[];
}) {
  const { cargarPedido, abrir } = useCart();
  const [abierto, setAbierto] = useState<"efectivo" | "pago" | "clave" | null>(null);
  const [pedidoAbierto, setPedidoAbierto] = useState<string | null>(null);
  const [filtroActividad, setFiltroActividad] = useState<"todos" | "web" | "tienda">("todos");
  const [preview, setPreview] = useState<string | null>(null);
  const [estadoPerfil, guardarPerfil, pendingPerfil] = useActionState<
    EstadoCuentaCliente,
    FormData
  >(clienteActualizarPerfil, null);
  const [estadoClave, cambiarClave, pendingClave] = useActionState<
    EstadoCuentaCliente,
    FormData
  >(clienteCambiarClave, null);
  const [estadoEfectivo, pedirEfectivo, pendingEfectivo] = useActionState<
    EstadoCuentaCliente,
    FormData
  >(clienteSolicitarEfectivo, null);
  const [estadoPago, informarPago, pendingPago] = useActionState<
    EstadoCuentaCliente,
    FormData
  >(clienteInformarPago, null);
  const [estadoAlias, guardarAlias, pendingAlias] = useActionState<
    EstadoCuentaCliente,
    FormData
  >(clienteGuardarAlias, null);

  const perfil = usuario.perfil;
  const tipo = parseTipoCuenta(usuario.tipoCuenta);
  const foto = preview || perfil?.fotoPerfil || FOTO_DEFAULT;
  const tickets = resumen?.ticketsVigentes ?? [];
  const semaforo = semaforoDeuda(tickets);
  const capital = resumen?.saldoTotal ?? 0;
  const interesTotal = interesTotalDeuda(tickets);
  const mostrar = capital + interesTotal;

  const tono =
    semaforo === "rojo"
      ? "bg-cape text-white"
      : semaforo === "amarillo"
        ? "bg-amber-400 text-neutral-900"
        : "bg-emerald-600 text-white";

  const leyenda =
    semaforo === "rojo"
      ? "Mora (10% o más)"
      : semaforo === "amarillo"
        ? "Primer recargo (5%)"
        : capital > 0
          ? "Al día, dentro del plazo"
          : "Sin deuda";

  const hayDatosPago = Boolean(ajustes.alias || ajustes.cbu);

  const actividad = useMemo(() => {
    const idsPedido = new Set(pedidos.map((p) => p.id));
    const tienda = (resumen?.ticketsVigentes ?? [])
      .concat(resumen?.ticketsPagados ?? [])
      .filter((t) => t.origen !== "web" && !idsPedido.has(t.pedidoId ?? ""));
    return { pedidos, tienda: tienda.slice(0, 20) };
  }, [pedidos, resumen]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-gradient-to-br from-movipack-deep to-neutral-900 px-5 py-6 text-white sm:px-7">
          <p className="text-sm font-semibold text-white/70">Mi cuenta</p>
          <h1 className="mt-1 font-display text-3xl font-bold italic">
            Hola, {usuario.nombre.split(" ")[0]}
          </h1>
          <p className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
            {ETIQUETA_TIPO_CUENTA[tipo]}
          </p>
        </div>
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-start">
          <form action={guardarPerfil} className="space-y-3">
            <p className="text-sm text-neutral-500">{usuario.email}</p>
            <label className="block text-xs font-bold text-neutral-600">
              Nombre
              <input
                name="nombre"
                required
                defaultValue={usuario.nombre}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-bold text-neutral-600">
              Teléfono
              <input
                name="telefono"
                required
                defaultValue={perfil?.telefono ?? ""}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-bold text-neutral-600">
              Domicilio
              <input
                name="direccion"
                required
                defaultValue={perfil?.direccion ?? ""}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <fieldset>
              <legend className="text-xs font-bold text-neutral-600">
                Franja de entrega
              </legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="franjaReparto"
                    value="manana"
                    defaultChecked={perfil?.franjaReparto === "manana"}
                  />
                  {ETIQUETA_FRANJA.manana}
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="franjaReparto"
                    value="tarde"
                    defaultChecked={perfil?.franjaReparto === "tarde"}
                  />
                  {ETIQUETA_FRANJA.tarde}
                </label>
              </div>
            </fieldset>
            <input type="hidden" name="foto" />
            <button
              type="submit"
              disabled={pendingPerfil}
              className="rounded-xl bg-movipack px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {pendingPerfil ? "Guardando…" : "Guardar datos"}
            </button>
            {estadoPerfil?.ok && (
              <p className="text-sm font-semibold text-emerald-700">{estadoPerfil.ok}</p>
            )}
            {estadoPerfil?.error && (
              <p className="text-sm font-semibold text-cape">{estadoPerfil.error}</p>
            )}
          </form>
          <div className="flex flex-col items-center gap-3 lg:min-w-56">
            <form action={guardarPerfil} className="flex flex-col items-center">
              <FotoPerfil
                src={foto}
                nombre={usuario.nombre}
                onPick={(file) => {
                  setPreview(URL.createObjectURL(file));
                  const data = new FormData();
                  data.set("nombre", usuario.nombre);
                  data.set("telefono", perfil?.telefono ?? "");
                  data.set("direccion", perfil?.direccion ?? "");
                  if (perfil?.franjaReparto) data.set("franjaReparto", perfil.franjaReparto);
                  data.set("foto", file);
                  void guardarPerfil(data);
                }}
              />
              <input type="hidden" name="telefono" value={perfil?.telefono ?? ""} />
              <input type="hidden" name="direccion" value={perfil?.direccion ?? ""} />
            </form>
            <div className="text-center text-sm text-neutral-600">
              <p className="text-xs text-neutral-500">Tocá la foto para cambiarla</p>
              <p className="mt-2 font-bold text-movipack-deep">{usuario.nombre}</p>
              <p>{perfil?.direccion || "Sin domicilio cargado"}</p>
              <p>{perfil?.telefono || "Sin teléfono"}</p>
              <p>
                {perfil?.franjaReparto
                  ? ETIQUETA_FRANJA[perfil.franjaReparto]
                  : "Franja a coordinar"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-xl font-bold not-italic text-movipack-deep">
          Mi perfil
        </h2>
        <p className="mt-1 text-sm font-bold text-movipack">{ETIQUETA_TIPO_CUENTA[tipo]}</p>
        <p className="mt-1 text-sm text-neutral-600">{DETALLE_TIPO_CUENTA[tipo]}</p>
        <p className="mt-2 text-sm text-neutral-600">
          {veDescuentos(tipo)
            ? "En el catálogo ves precios con descuento."
            : "En el catálogo ves precios de lista, sin descuento."}
        </p>
        {tieneCreditoSuper(tipo) && (
          <div className="mt-4 rounded-2xl border border-movipack/15 bg-movipack/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-movipack">
              Crédito supermercado
            </p>
            <p className="mt-1 font-display text-3xl font-bold italic text-movipack-deep">
              {formatoPesos(resumen?.disponibleAlmacen ?? 0)}
            </p>
            <p className="text-sm text-neutral-600">
              disponibles de {formatoPesos(resumen?.cliente.limiteAlmacen ?? 0)} ·
              usado {formatoPesos(resumen?.saldoAlmacen ?? 0)}
            </p>
          </div>
        )}
        {tieneLineaCredito(tipo) && (
          <div className="mt-4 rounded-2xl border border-movipack/15 bg-movipack/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-movipack">
              Línea de crédito
            </p>
            <p className="mt-1 font-display text-3xl font-bold italic text-movipack-deep">
              {formatoPesos(resumen?.disponibleEfectivo ?? 0)}
            </p>
            <p className="text-sm text-neutral-600">
              disponibles de {formatoPesos(resumen?.cliente.limiteEfectivo ?? 0)} ·
              usado {formatoPesos(resumen?.saldoEfectivo ?? 0)}
            </p>
          </div>
        )}
        {!tieneCreditoSuper(tipo) && !tieneLineaCredito(tipo) && (
          <p className="mt-3 text-sm text-neutral-500">
            No tenés crédito ni línea asignada. Si el local te habilita una,
            el monto aparece acá.
          </p>
        )}
      </section>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/catalogo"
          className="rounded-2xl bg-movipack px-4 py-3 text-center text-sm font-bold text-white"
        >
          Ir al catálogo
        </Link>
        <button
          type="button"
          className="rounded-2xl border border-movipack px-4 py-3 text-sm font-bold text-movipack"
          onClick={() => {
            const ultimo = pedidos[0];
            if (!ultimo) return;
            cargarPedido(
              ultimo.lineas.map((l) => ({
                id: l.id,
                codigo: l.codigo,
                nombre: l.nombre,
                precio: l.precio,
                precioLista: l.precioLista,
                cantidad: l.cantidad,
              })),
            );
            abrir();
          }}
        >
          Repetir último pedido
        </button>
        <a
          href={whatsappUrl(
            `Hola La Triple L, soy ${usuario.nombre}. Te escribo desde Mi cuenta.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl border border-[#25D366] px-4 py-3 text-center text-sm font-bold text-[#128C7E]"
        >
          Escribir al local
        </a>
        <button
          type="button"
          className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-bold text-neutral-700"
          onClick={() => setAbierto(abierto === "clave" ? null : "clave")}
        >
          Cambiar PIN o clave
        </button>
      </div>

      {abierto === "clave" && (
        <form action={cambiarClave} className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="font-bold text-movipack-deep">Nueva contraseña o PIN</p>
          <input
            name="password"
            type="password"
            required
            placeholder="PIN de 4 números o clave"
            className="mt-3 w-full rounded-xl border px-3 py-2"
          />
          {estadoClave?.error && (
            <p className="mt-2 text-sm font-semibold text-cape">{estadoClave.error}</p>
          )}
          {estadoClave?.ok && (
            <p className="mt-2 text-sm font-semibold text-emerald-700">{estadoClave.ok}</p>
          )}
          <button
            type="submit"
            disabled={pendingClave}
            className="mt-3 rounded-xl bg-movipack px-4 py-2 text-sm font-bold text-white"
          >
            {pendingClave ? "Guardando…" : "Actualizar"}
          </button>
        </form>
      )}

      <section className={`rounded-3xl p-6 shadow-md ${tono}`}>
        <p className="text-sm font-bold uppercase tracking-wide opacity-90">
          Deuda del local
        </p>
        <p className="mt-2 font-display text-4xl font-bold italic sm:text-5xl">
          {formatoPesos(mostrar)}
        </p>
        <p className="mt-1 text-sm font-semibold">{leyenda}</p>
        {interesTotal > 0 && (
          <p className="mt-1 text-sm">
            Capital {formatoPesos(capital)} + intereses por mora{" "}
            {formatoPesos(interesTotal)}
          </p>
        )}
        {tickets.length > 0 ? (
          <ul className="mt-4">
            {tickets.map((t) => (
              <TicketFila key={t.id} ticket={t} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm opacity-90">
            No hay cargos vigentes. Los tickets de tienda y los pedidos web
            aparecen acá cuando se generan.
          </p>
        )}
      </section>

      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {AVISO_INTERES}
      </p>

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-xl font-bold not-italic text-movipack-deep">
          Actividad
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Pedidos web y tickets de tienda. El estado lo actualiza el local; no
          se puede modificar desde acá.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["todos", "web", "tienda"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltroActividad(f)}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                filtroActividad === f
                  ? "border-movipack bg-movipack text-white"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {f === "todos" ? "Todo" : f === "web" ? "Pedidos web" : "Tickets de tienda"}
            </button>
          ))}
        </div>
        <ul className="mt-4 divide-y divide-neutral-100">
          {((filtroActividad !== "tienda" ? actividad.pedidos : []).length === 0 &&
            (filtroActividad !== "web" ? actividad.tienda : []).length === 0) && (
            <li className="py-6 text-sm text-neutral-500">Todavía no hay movimientos.</li>
          )}
          {filtroActividad !== "tienda" &&
            actividad.pedidos.map((pedido) => {
            const abiertoAhora = pedidoAbierto === pedido.id;
            return (
              <li key={pedido.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                      Pedido web {pedido.numeroTicket || ""}
                    </p>
                    <p className="font-semibold text-movipack-deep">
                      {formatoFecha(pedido.creadoEn)} · {ESTADO_PEDIDO[pedido.estado]}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {pedido.contacto.horarios ||
                        (pedido.franjaReparto
                          ? ETIQUETA_FRANJA[pedido.franjaReparto]
                          : "")}
                      {pedido.siFaltaProducto
                        ? ` · ${ETIQUETA_SI_FALTA[pedido.siFaltaProducto]}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatoPesos(pedido.total)}</p>
                    <button
                      type="button"
                      className="text-xs font-bold text-movipack underline"
                      onClick={() =>
                        setPedidoAbierto(abiertoAhora ? null : pedido.id)
                      }
                    >
                      {abiertoAhora ? "Ocultar desglose" : "Ver desglose"}
                    </button>
                    <button
                      type="button"
                      className="ml-2 text-xs font-bold text-neutral-500 underline"
                      onClick={() => {
                        cargarPedido(
                          pedido.lineas.map((l) => ({
                            id: l.id,
                            codigo: l.codigo,
                            nombre: l.nombre,
                            precio: l.precio,
                            precioLista: l.precioLista,
                            cantidad: l.cantidad,
                          })),
                        );
                        abrir();
                      }}
                    >
                      Repetir
                    </button>
                  </div>
                </div>
                {abiertoAhora && (
                  <ul className="mt-3 space-y-1 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    {pedido.lineas.map((linea) => (
                      <li key={`${pedido.id}-${linea.id}`}>
                        {linea.cantidad} × {nombreVitrina(linea.nombre)} (cód.{" "}
                        {linea.codigo}) — {formatoPesos(linea.precio * linea.cantidad)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {filtroActividad !== "web" &&
            actividad.tienda.map((ticket) => (
            <li key={ticket.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                  Ticket de tienda {numeroVisibleTicket(ticket)}
                </p>
                <p className="font-semibold text-movipack-deep">
                  {formatoFecha(ticket.fecha)} · {ETIQUETA_COBRO[estadoCobroTicket(ticket)]}
                </p>
                <p className="text-sm text-neutral-500">
                  Vence {formatoFecha(vencimientoDeTicket(ticket))}.
                </p>
                {ticket.adjunto ? (
                  <a
                    href={ticket.adjunto}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-movipack underline"
                  >
                    Descargar factura
                  </a>
                ) : (
                  <p className="text-xs text-neutral-400">
                    Cuando el local adjunte la factura, la vas a poder bajar acá.
                  </p>
                )}
              </div>
              <p className="font-bold">{formatoPesos(ticket.debe || ticket.total)}</p>
            </li>
          ))}
        </ul>
      </section>

      {(resumen || tieneLineaCredito(tipo)) && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {tieneLineaCredito(tipo) && (
            <button
              type="button"
              onClick={() => setAbierto(abierto === "efectivo" ? null : "efectivo")}
              className="rounded-2xl bg-movipack px-4 py-4 text-sm font-bold text-white"
            >
              Solicitar efectivo
            </button>
            )}
            {resumen && (
            <button
              type="button"
              onClick={() => setAbierto(abierto === "pago" ? null : "pago")}
              className="rounded-2xl border-2 border-movipack px-4 py-4 text-sm font-bold text-movipack"
            >
              Informar pago
            </button>
            )}
          </div>

          {abierto === "efectivo" && (
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="font-bold text-movipack-deep">Pedido de efectivo</h2>
              <form action={pedirEfectivo} className="mt-4 space-y-3">
                <input name="monto" required placeholder="Monto" className="w-full rounded-xl border px-3 py-2" />
                <input
                  name="aliasCbu"
                  required
                  defaultValue={resumen?.cliente.aliasCbu ?? ""}
                  placeholder="Alias o CBU"
                  className="w-full rounded-xl border px-3 py-2"
                />
                <input name="nota" placeholder="Nota" className="w-full rounded-xl border px-3 py-2" />
                {estadoEfectivo?.error && (
                  <p className="text-sm font-semibold text-cape">{estadoEfectivo.error}</p>
                )}
                {estadoEfectivo?.ok && (
                  <p className="text-sm font-semibold text-emerald-700">{estadoEfectivo.ok}</p>
                )}
                <button
                  type="submit"
                  disabled={pendingEfectivo}
                  className="rounded-xl bg-cape px-4 py-3 text-sm font-bold text-white"
                >
                  {pendingEfectivo ? "Enviando…" : "Enviar pedido"}
                </button>
              </form>
            </section>
          )}

          {abierto === "pago" && (
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="font-bold text-movipack-deep">Informar un pago</h2>
              {hayDatosPago && (
                <div className="mt-3 rounded-2xl bg-neutral-50 p-4 text-sm">
                  {ajustes.titular && <p>Titular: {ajustes.titular}</p>}
                  {ajustes.alias && (
                    <p>
                      Alias: {ajustes.alias}{" "}
                      <button
                        type="button"
                        className="text-xs font-bold text-movipack underline"
                        onClick={() => void navigator.clipboard.writeText(ajustes.alias)}
                      >
                        Copiar
                      </button>
                    </p>
                  )}
                  {ajustes.cbu && (
                    <p>
                      CBU: {ajustes.cbu}{" "}
                      <button
                        type="button"
                        className="text-xs font-bold text-movipack underline"
                        onClick={() => void navigator.clipboard.writeText(ajustes.cbu)}
                      >
                        Copiar
                      </button>
                    </p>
                  )}
                </div>
              )}
              <form action={informarPago} className="mt-4 space-y-3">
                <input name="monto" required placeholder="Monto pagado" className="w-full rounded-xl border px-3 py-2" />
                <select name="medio" className="w-full rounded-xl border px-3 py-2" defaultValue="transferencia">
                  <option value="transferencia">Transferencia</option>
                  <option value="local">Pagué en el local</option>
                </select>
                <input name="comprobante" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
                <input name="nota" placeholder="Nota" className="w-full rounded-xl border px-3 py-2" />
                {estadoPago?.error && (
                  <p className="text-sm font-semibold text-cape">{estadoPago.error}</p>
                )}
                {estadoPago?.ok && (
                  <p className="text-sm font-semibold text-emerald-700">{estadoPago.ok}</p>
                )}
                <button
                  type="submit"
                  disabled={pendingPago}
                  className="rounded-xl bg-cape px-4 py-3 text-sm font-bold text-white"
                >
                  {pendingPago ? "Enviando…" : "Notificar que ya pagué"}
                </button>
              </form>
            </section>
          )}

          {resumen && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="font-bold text-movipack-deep">Alias o CBU para acreditarte</h2>
            <form action={guardarAlias} className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                name="aliasCbu"
                defaultValue={resumen.cliente.aliasCbu}
                className="flex-1 rounded-xl border px-3 py-2"
              />
              <button
                type="submit"
                disabled={pendingAlias}
                className="rounded-xl border border-movipack px-4 py-2 text-sm font-bold text-movipack"
              >
                {pendingAlias ? "Guardando…" : "Guardar"}
              </button>
            </form>
            {estadoAlias?.ok && (
              <p className="mt-2 text-sm font-semibold text-emerald-700">{estadoAlias.ok}</p>
            )}
          </section>
          )}
        </>
      )}

      {!resumen && !tieneCreditoSuper(tipo) && !tieneLineaCredito(tipo) && (
        <p className="text-center text-sm text-neutral-500">
          Si el local te asigna descuentos o un crédito, el tipo de cuenta y
          los montos aparecen en Mi perfil.{" "}
          <Link href="/catalogo" className="font-bold text-movipack underline">
            Ir al catálogo
          </Link>
        </p>
      )}
    </div>
  );
}
