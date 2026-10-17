"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  clienteActualizarPerfil,
  clienteCambiarClave,
  clienteInformarPago,
  clienteSolicitarEfectivo,
  type EstadoCuentaCliente,
} from "@/app/acciones/cuenta-cliente";
import { useCart } from "@/components/CartProvider";
import { PerfilCuenta, type CompraPerfil } from "@/components/PerfilCuenta";
import { whatsappUrl } from "@/lib/whatsapp";
import { parseTipoCuenta, tieneLineaCredito } from "@/lib/tipo-cuenta";
import { plazoCuentaDias } from "@/lib/plazo-cuenta";
import { etiquetaFormaPago } from "@/lib/venta-texto";
import type { UsuarioPublico } from "@/types/auth";
import type { AjustesCuenta, ResumenCliente } from "@/types/cuenta";
import { ETIQUETA_FRANJA, type Pedido } from "@/types/pedido";

const FOTO_DEFAULT = "/recursos/logo.jpg";

export type VentaPerfil = {
  id: string;
  numero: number;
  creadoEn: string;
  formaPago: string;
  total: number;
  lineas: { nombre: string; cantidad: number; precio: number }[];
};

function FotoPerfil({
  src,
  nombre,
  editable,
  onPick,
}: {
  src: string;
  nombre: string;
  editable: boolean;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const foto = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src || FOTO_DEFAULT} alt={nombre} className="h-full w-full object-cover" />
      {editable && (
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-white">
          Editar
        </span>
      )}
    </>
  );
  return (
    <div className="flex flex-col items-center">
      {editable ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="relative h-28 w-28 overflow-hidden rounded-full bg-white shadow-lg ring-4 ring-white"
          aria-label="Cambiar foto de perfil"
        >
          {foto}
        </button>
      ) : (
        <span className="relative grid h-28 w-28 overflow-hidden rounded-full bg-white shadow-lg ring-4 ring-white">
          {foto}
        </span>
      )}
      {editable && (
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
      )}
    </div>
  );
}

export function CuentaClientePanel({
  usuario,
  resumen,
  ajustes,
  tasas,
  pedidos,
  ventas,
}: {
  usuario: UsuarioPublico;
  resumen: ResumenCliente | null;
  ajustes: AjustesCuenta;
  tasas: {
    tasasCuota: { 1: number; 2: number; 3: number; 6: number };
    moraCredito: number[];
    moraCuenta: number[];
    plazoCuenta: number;
  };
  pedidos: Pedido[];
  ventas: VentaPerfil[];
}) {
  const { cargarPedido, abrir } = useCart();
  const [abierto, setAbierto] = useState<"efectivo" | "pago" | "clave" | null>(null);
  const [editando, setEditando] = useState(false);
  const [avisoAlias, setAvisoAlias] = useState("");
  const datosRef = useRef<HTMLElement>(null);
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

  const perfil = usuario.perfil;
  const tipo = parseTipoCuenta(usuario.tipoCuenta);
  const foto = preview || perfil?.fotoPerfil || FOTO_DEFAULT;
  const aliasCliente = resumen?.cliente.aliasCbu?.trim() ?? "";
  const hayDatosPago = Boolean(ajustes.alias || ajustes.cbu);
  const franja = perfil?.franjaReparto ? ETIQUETA_FRANJA[perfil.franjaReparto] : "A coordinar";

  useEffect(() => {
    if (estadoPerfil?.ok) setEditando(false);
  }, [estadoPerfil]);
  const compras = useMemo(() => {
    const numeros = new Set(ventas.map((v) => String(v.numero)));
    const deLocal: CompraPerfil[] = ventas.map((venta) => ({
      id: venta.id,
      fecha: venta.creadoEn,
      origen: "local",
      titulo: `Comprobante ${venta.numero}`,
      total: venta.total,
      detalle: `Compra en el local · ${etiquetaFormaPago(venta.formaPago)}`,
      descarga: `/cuenta/comprobante/${venta.id}?formato=ticket`,
      lineas: venta.lineas.map((linea) => ({
        nombre: linea.nombre,
        cantidad: linea.cantidad,
        monto: linea.precio * linea.cantidad,
      })),
    }));
    const deWeb: CompraPerfil[] = pedidos.map((pedido) => {
      if (pedido.esRecarga) {
        const nota = pedido.recargaAcreditada
          ? "El local confirmó la transferencia y sumó el saldo."
          : pedido.recargaRechazada
            ? "El local rechazó esta recarga. El saldo no cambió."
            : "Esperando que el local confirme la transferencia.";
        return {
          id: pedido.id,
          fecha: pedido.creadoEn,
          origen: "web" as const,
          titulo: "Recarga de cuenta",
          total: pedido.total,
          detalle: nota,
          proceso: { paso: pedido.recargaAcreditada || pedido.recargaRechazada ? 2 : 0, nota },
          lineas: pedido.lineas.map((linea) => ({
            nombre: linea.nombre,
            cantidad: linea.cantidad,
            monto: linea.precio * linea.cantidad,
          })),
        };
      }
      const paso = pedido.estado === "terminado" ? 2 : pedido.estado === "en_proceso" || pedido.estado === "enviando" ? 1 : 0;
      const etiqueta =
        pedido.estado === "enviando" ? "Enviando" : paso === 2 ? "Entregado" : paso === 1 ? "En preparación" : "Recibido";
      const llega = pedido.contacto.horarios || "el horario que elegiste";
      const transfiere =
        pedido.pago?.forma === "transferencia" || pedido.pago?.forma === "mixto";
      const nota =
        paso === 2
          ? "Pedido entregado."
          : paso === 1
            ? pedido.estado === "enviando"
              ? `Ya salió para que te llegue ${llega}.`
              : `Lo estamos preparando para que te llegue ${llega}.`
            : transfiere
              ? `El local recibió tu pedido y lo está procesando para que te llegue ${llega}. Una vez que pagues, se despacha automáticamente. No hace falta que mandes el comprobante.`
              : `El local recibió tu pedido y lo está procesando para que te llegue ${llega}.`;
      return {
        id: pedido.id,
        fecha: pedido.creadoEn,
        origen: "web" as const,
        titulo: pedido.numeroTicket ? `Pedido ${pedido.numeroTicket}` : "Pedido web",
        total: pedido.total,
        detalle: `${etiqueta} · Pedido por internet`,
        entrega: pedido.contacto.horarios || undefined,
        proceso: { paso, nota },
        lineas: pedido.lineas.map((linea) => ({
          nombre: linea.nombre,
          cantidad: linea.cantidad,
          monto: linea.precio * linea.cantidad,
        })),
      };
    });
    const sueltos: CompraPerfil[] = (resumen?.ticketsVigentes ?? [])
      .concat(resumen?.ticketsPagados ?? [])
      .filter(
        (t) =>
          t.origen !== "web" &&
          !numeros.has((t.numero ?? "").trim()) &&
          !(t.pedidoId && pedidos.some((p) => p.id === t.pedidoId)),
      )
      .map((ticket) => ({
        id: ticket.id,
        fecha: ticket.fecha,
        origen: "local" as const,
        titulo: `Ticket ${ticket.numero?.trim() || ticket.id}`,
        total: ticket.total || ticket.debe,
        detalle: "Compra en el local",
        descarga: ticket.adjunto || undefined,
        lineas: (ticket.lineas ?? []).map((linea) => ({
          nombre: linea.nombre,
          cantidad: 1,
          monto: linea.monto ?? 0,
        })),
      }));
    return [...deLocal, ...deWeb, ...sueltos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ventas, pedidos, resumen]);

  return (
    <div className="space-y-5">
      <PerfilCuenta
        nombre={usuario.nombre.split(" ")[0] || usuario.nombre}
        saldo={Math.max(0, Math.round(resumen?.cliente.saldo ?? 0))}
        alias={ajustes.alias ?? ""}
        cbu={ajustes.cbu ?? ""}
        titular={ajustes.titular ?? ""}
        nombreLocal={ajustes.nombreLocal ?? "La Triple L"}
        limiteCredito={resumen?.cliente.limiteEfectivo ?? 0}
        usadoCredito={resumen?.saldoEfectivo ?? 0}
        cuotasMaximas={resumen?.cliente.cuotasMaximas}
        cuotasHabilitadas={resumen?.cliente.cuotasHabilitadas}
        interesModo={resumen?.cliente.interesModo}
        interes1={resumen?.cliente.interes1}
        interes2={resumen?.cliente.interes2}
        interes3={resumen?.cliente.interes3}
        interes6={resumen?.cliente.interes6}
        limiteMercaderia={resumen?.cliente.limiteAlmacen ?? 0}
        usadoMercaderia={resumen?.saldoAlmacen ?? 0}
        moraModo={resumen?.cliente.moraModo}
        moraPorcentaje={resumen?.cliente.moraPorcentaje}
        moraCreditoModo={resumen?.cliente.moraCreditoModo}
        moraCreditoPorcentaje={resumen?.cliente.moraCreditoPorcentaje}
        moraCuentaModo={resumen?.cliente.moraCuentaModo}
        moraCuentaPorcentaje={resumen?.cliente.moraCuentaPorcentaje}
        moraCredito={tasas.moraCredito}
        moraCuenta={tasas.moraCuenta}
        tasasCuota={tasas.tasasCuota}
        plazoCuenta={plazoCuentaDias(resumen?.cliente.plazoCuenta, tasas.plazoCuenta)}
        aliasCliente={resumen?.cliente.aliasCbu ?? ""}
        onFaltaAlias={() => {
          setEditando(true);
          setAvisoAlias("Para pedir crédito tenés que cargar tu alias o CBU.");
          datosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        tickets={[...(resumen?.ticketsVigentes ?? []), ...(resumen?.ticketsPagados ?? [])]}
        compras={compras}
      />
      <section ref={datosRef} id="datos-personales" className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 sm:px-7">
          <h2 className="font-display text-xl font-bold text-movipack-deep">Datos personales</h2>
          {!editando && (
            <button
              type="button"
              onClick={() => {
                setAvisoAlias("");
                setEditando(true);
              }}
              className="rounded-full bg-[#009ee3] px-4 py-2 text-sm font-bold text-white"
            >
              Modificar
            </button>
          )}
        </div>
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[auto_1fr] lg:items-start">
          <FotoPerfil
            src={foto}
            nombre={usuario.nombre}
            editable={editando}
            onPick={(file) => {
              setPreview(URL.createObjectURL(file));
              const data = new FormData();
              data.set("nombre", usuario.nombre);
              data.set("telefono", perfil?.telefono ?? "");
              data.set("direccion", perfil?.direccion ?? "");
              if (perfil?.franjaReparto) data.set("franjaReparto", perfil.franjaReparto);
              data.set("aliasCbu", aliasCliente);
              data.set("foto", file);
              void guardarPerfil(data);
            }}
          />
          {editando ? (
            <form action={guardarPerfil} className="space-y-3">
              <p className="text-sm text-neutral-500">{usuario.email}</p>
              {avisoAlias && <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{avisoAlias}</p>}
              <label className="block text-xs font-bold text-neutral-600">
                Nombre
                <input name="nombre" required defaultValue={usuario.nombre} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-bold text-neutral-600">
                Teléfono
                <input name="telefono" required defaultValue={perfil?.telefono ?? ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-bold text-neutral-600">
                Domicilio
                <input name="direccion" required defaultValue={perfil?.direccion ?? ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </label>
              <fieldset>
                <legend className="text-xs font-bold text-neutral-600">Franja de entrega</legend>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                    <input type="radio" name="franjaReparto" value="manana" defaultChecked={perfil?.franjaReparto === "manana"} />
                    {ETIQUETA_FRANJA.manana}
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                    <input type="radio" name="franjaReparto" value="tarde" defaultChecked={perfil?.franjaReparto === "tarde"} />
                    {ETIQUETA_FRANJA.tarde}
                  </label>
                </div>
              </fieldset>
              <label id="alias-cobro" className="block text-xs font-bold text-neutral-600">
                Alias o CBU para que te acrediten un crédito
                <input name="aliasCbu" defaultValue={aliasCliente} placeholder="Tu alias o CBU" className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </label>
              {estadoPerfil?.ok && <p className="text-sm font-semibold text-emerald-700">{estadoPerfil.ok}</p>}
              {estadoPerfil?.error && <p className="text-sm font-semibold text-cape">{estadoPerfil.error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pendingPerfil} className="rounded-full bg-[#009ee3] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {pendingPerfil ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" className="rounded-full px-4 py-2.5 text-sm font-bold text-neutral-600" onClick={() => setEditando(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold text-neutral-400">Mail</dt>
                <dd className="font-semibold text-neutral-950">{usuario.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-neutral-400">Nombre</dt>
                <dd className="font-semibold text-neutral-950">{usuario.nombre}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-neutral-400">Teléfono</dt>
                <dd className="font-semibold text-neutral-950">{perfil?.telefono || "Sin teléfono"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-neutral-400">Domicilio</dt>
                <dd className="font-semibold text-neutral-950">{perfil?.direccion || "Sin domicilio"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-neutral-400">Entrega</dt>
                <dd className="font-semibold text-neutral-950">{franja}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-neutral-400">Alias o CBU</dt>
                <dd className="font-semibold text-neutral-950">{aliasCliente || "Sin cargar"}</dd>
              </div>
              {avisoAlias && <p className="sm:col-span-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{avisoAlias}</p>}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className="text-sm font-bold text-[#009ee3]"
                  onClick={() => setAbierto(abierto === "clave" ? null : "clave")}
                >
                  Cambiar contraseña
                </button>
              </div>
            </dl>
          )}
        </div>
        {abierto === "clave" && !editando && (
          <form action={cambiarClave} className="border-t border-neutral-100 px-5 py-4 sm:px-7">
            <p className="font-semibold text-neutral-950">Cambiar contraseña</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input name="actual" type="password" required placeholder="Contraseña actual" className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              <input name="password" type="password" required placeholder="Nueva contraseña" className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              <input name="repetir" type="password" required placeholder="Repetir la nueva" className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
            </div>
            {estadoClave?.error && <p className="mt-2 text-sm font-semibold text-cape">{estadoClave.error}</p>}
            {estadoClave?.ok && <p className="mt-2 text-sm font-semibold text-emerald-700">{estadoClave.ok}</p>}
            <button type="submit" disabled={pendingClave} className="mt-3 rounded-full bg-[#009ee3] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {pendingClave ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </form>
        )}
      </section>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>

      {(resumen || tieneLineaCredito(tipo)) && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {tieneLineaCredito(tipo) && (
            <button
              type="button"
              onClick={() => {
                if (!aliasCliente) {
                  setEditando(true);
                  setAvisoAlias("Para pedir crédito tenés que cargar tu alias o CBU.");
                  datosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
                setAbierto(abierto === "efectivo" ? null : "efectivo");
              }}
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
                <input type="hidden" name="aliasCbu" value={aliasCliente} />
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
        </>
      )}

    </div>
  );
}
