"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adminCambiarEmail,
  adminCambiarEstadoCuenta,
  adminCambiarPassword,
  adminCambiarRol,
  adminEliminarUsuario,
  adminGuardarCreditoCliente,
  adminGuardarPerfil,
  type EstadoAdminCuentas,
} from "@/app/acciones/cuentas";
import { formatoFecha, formatoPesos } from "@/lib/format";
import { semaforoDeuda } from "@/lib/deuda";
import { resumenOperativoFicha } from "@/lib/ficha-cliente";
import {
  DETALLE_TIPO_CUENTA,
  ETIQUETA_TIPO_CUENTA,
  parseTipoCuenta,
  tieneCreditoSuper,
  tieneLineaCredito,
} from "@/lib/tipo-cuenta";
import { whatsappATelefono } from "@/lib/whatsapp";
import type { TipoCuentaCliente, UsuarioPublico } from "@/types/auth";
import type { ResumenCliente } from "@/types/cuenta";
import type { Pedido } from "@/types/pedido";
import { ETIQUETA_FRANJA } from "@/types/pedido";

const campo =
  "mt-1 w-full rounded-xl border border-movipack/20 px-3 py-2.5 text-sm outline-none focus:border-movipack";
const btn =
  "rounded-xl border border-movipack/30 px-4 py-2.5 text-sm font-bold text-movipack disabled:opacity-60";
const btnFuerte =
  "rounded-xl bg-movipack px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60";
const etiqueta = "block text-sm font-bold text-movipack-deep";
const ayuda = "mt-0.5 text-xs font-medium text-neutral-500";

const ESTADO: Record<UsuarioPublico["estado"], string> = {
  pendiente: "Solicitud pendiente",
  activa: "Cuenta activa",
  rechazada: "Solicitud rechazada",
};

export function AdminClienteFicha({
  usuario,
  resumen,
  pedidos,
}: {
  usuario: UsuarioPublico;
  resumen: ResumenCliente | null;
  pedidos: Pedido[];
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoAdminCuentas>(null);
  const [pending, start] = useTransition();
  const stats = resumenOperativoFicha(usuario, resumen, pedidos);
  const tipo = parseTipoCuenta(usuario.tipoCuenta);
  const semaforo = semaforoDeuda(resumen?.ticketsVigentes ?? []);
  const perfil = usuario.perfil;
  const wa = whatsappATelefono(
    perfil?.telefono ?? "",
    `Hola ${usuario.nombre}, te escribo de La Triple L.`,
  );
  const montoAsignado = tieneCreditoSuper(tipo)
    ? resumen?.cliente.limiteAlmacen ?? 0
    : tieneLineaCredito(tipo)
      ? resumen?.cliente.limiteEfectivo ?? 0
      : 0;

  function run(
    tarea: () => Promise<EstadoAdminCuentas>,
    opciones?: { irALista?: boolean; form?: HTMLFormElement },
  ) {
    setMensaje(null);
    start(async () => {
      const resultado = await tarea();
      setMensaje(resultado);
      if (resultado?.ok) {
        opciones?.form?.reset();
        if (opciones?.irALista) router.push("/admin/clientes");
        else router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/clientes" className="text-sm font-bold text-movipack underline">
        ← Todas las fichas
      </Link>

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

      <header className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
          Ficha de cliente
        </p>
        <h2 className="mt-1 font-display text-3xl font-bold italic text-movipack-deep">
          {usuario.nombre}
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          {usuario.rol === "admin"
            ? "Administrador"
            : ETIQUETA_TIPO_CUENTA[tipo]}
          {" · "}
          {ESTADO[usuario.estado]}
          {" · Alta "}
          {formatoFecha(usuario.creadoEn)}
        </p>
        {usuario.rol !== "admin" && (
          <p className="mt-1 text-sm text-neutral-500">
            {semaforo === "rojo"
              ? "Deuda en mora (10% o más)"
              : semaforo === "amarillo"
                ? "Primer recargo (5%)"
                : stats.deuda > 0
                  ? "Deuda al día, dentro del plazo"
                  : "Sin deuda vigente"}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className={btnFuerte}
            >
              WhatsApp al cliente
            </a>
          )}
          {stats.clienteFiadoId && (
            <Link href={`/admin/cuentas/${stats.clienteFiadoId}`} className={btn}>
              Ver actividad / deuda
            </Link>
          )}
        </div>
      </header>

      {usuario.estado === "pendiente" && (
        <section className="flex flex-wrap gap-2 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="w-full text-sm font-semibold text-amber-900">
            Esta ficha todavía no puede ingresar. Aceptala o rechazala.
          </p>
          <button
            type="button"
            disabled={pending}
            className={btnFuerte}
            onClick={() => {
              const data = new FormData();
              data.set("id", usuario.id);
              data.set("estado", "activa");
              run(() => adminCambiarEstadoCuenta(data));
            }}
          >
            Aceptar solicitud
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-xl border border-cape px-4 py-2.5 text-sm font-bold text-cape disabled:opacity-60"
            onClick={() => {
              const data = new FormData();
              data.set("id", usuario.id);
              data.set("estado", "rechazada");
              run(() => adminCambiarEstadoCuenta(data));
            }}
          >
            Rechazar
          </button>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dato
          nombre="Total vendido"
          valor={formatoPesos(stats.vendido)}
          detalle="Suma de comprobantes y pedidos web sin duplicar"
        />
        <Dato
          nombre="Comprobantes en actividad"
          valor={String(stats.comprobantes)}
          detalle="Tickets cargados en su ficha de deuda"
        />
        <Dato
          nombre="Deuda vigente"
          valor={formatoPesos(stats.deuda)}
          detalle={
            stats.mora > 0
              ? `Más intereses por mora ${formatoPesos(stats.mora)}`
              : "Capital pendiente, sin mora extra"
          }
        />
        <Dato
          nombre="Pedidos web"
          valor={String(stats.pedidos)}
          detalle={`Última actividad ${formatoFecha(stats.ultimaActividad)}`}
        />
      </section>

      <form
        key={`perfil-${usuario.id}-${usuario.nombre}-${perfil?.telefono}-${perfil?.direccion}-${usuario.notaInterna ?? ""}`}
        className="space-y-8 rounded-3xl bg-white p-5 shadow-sm sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => adminGuardarPerfil(new FormData(e.currentTarget)));
        }}
      >
        <input type="hidden" name="id" value={usuario.id} />

        <fieldset className="space-y-3">
          <legend className="font-display text-xl font-bold not-italic text-movipack-deep">
            Información de contacto
          </legend>
          <p className="text-sm text-neutral-500">
            Cómo figura la persona o el negocio en el sistema.
          </p>
          <label className={etiqueta}>
            Nombre o razón social
            <p className={ayuda}>El nombre que ves en pedidos y deudas.</p>
            <input name="nombre" required defaultValue={usuario.nombre} className={campo} />
          </label>
          <label className={etiqueta}>
            Tipo de persona
            <p className={ayuda}>Persona física o empresa.</p>
            <select
              name="tipoPersona"
              defaultValue={perfil?.tipoPersona ?? "persona"}
              className={campo}
            >
              <option value="persona">Persona</option>
              <option value="empresa">Empresa</option>
            </select>
          </label>
        </fieldset>

        <fieldset className="space-y-3 border-t border-neutral-100 pt-6">
          <legend className="font-display text-xl font-bold not-italic text-movipack-deep">
            Datos para el envío
          </legend>
          <p className="text-sm text-neutral-500">
            Teléfono, domicilio y franja para armar el reparto.
          </p>
          <label className={etiqueta}>
            Número de teléfono
            <p className={ayuda}>Celular con WhatsApp, si lo tiene.</p>
            <input
              name="telefono"
              defaultValue={perfil?.telefono ?? ""}
              className={campo}
            />
          </label>
          <label className={etiqueta}>
            Dirección de entrega
            <p className={ayuda}>Calle, número, piso y referencias.</p>
            <input
              name="direccion"
              defaultValue={perfil?.direccion ?? ""}
              className={campo}
            />
          </label>
          <fieldset>
            <legend className={etiqueta}>Franja de reparto</legend>
            <p className={ayuda}>Horario en el que prefiere recibir.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-movipack/20 px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="franjaReparto"
                  value="manana"
                  defaultChecked={perfil?.franjaReparto === "manana"}
                />
                {ETIQUETA_FRANJA.manana}
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-movipack/20 px-3 py-2 text-sm">
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
          <label className={etiqueta}>
            Horario de atención
            <p className={ayuda}>Si es un local, cuándo está abierto.</p>
            <input
              name="horarioAtencion"
              defaultValue={perfil?.horarioAtencion ?? ""}
              className={campo}
            />
          </label>
        </fieldset>

        <fieldset className="space-y-3 border-t border-neutral-100 pt-6">
          <legend className="font-display text-xl font-bold not-italic text-movipack-deep">
            Datos del negocio
          </legend>
          <p className="text-sm text-neutral-500">
            Lo que cargó al pedir la cuenta. Sirve para conocerlo.
          </p>
          <label className={etiqueta}>
            Tipo de local
            <p className={ayuda}>Almacén, kiosco, despensa, casa de familia, etc.</p>
            <input
              name="tipoLocal"
              defaultValue={perfil?.tipoLocal ?? ""}
              className={campo}
            />
          </label>
          <label className={etiqueta}>
            Productos de interés
            <p className={ayuda}>Qué suele comprar o qué le interesa.</p>
            <textarea
              name="productosInteres"
              defaultValue={perfil?.productosInteres ?? ""}
              className={campo}
              rows={2}
            />
          </label>
        </fieldset>

        <fieldset className="space-y-3 border-t border-neutral-100 pt-6">
          <legend className="font-display text-xl font-bold not-italic text-movipack-deep">
            Mensaje privado de la ficha
          </legend>
          <p className="text-sm text-neutral-500">
            Lo ves solo vos. El cliente no lo ve en su cuenta.
          </p>
          <label className={etiqueta}>
            Nota interna
            <p className={ayuda}>Recordatorios, acuerdos o comentarios del local.</p>
            <textarea
              name="notaInterna"
              defaultValue={usuario.notaInterna ?? ""}
              className={campo}
              rows={3}
              placeholder="Ej.: paga los viernes, no entregar sin aviso, etc."
            />
          </label>
        </fieldset>

        <button type="submit" disabled={pending} className={btnFuerte}>
          {pending ? "Guardando…" : "Guardar ficha"}
        </button>
      </form>

      {usuario.rol !== "admin" && (
        <FormTipoCliente
          key={`${usuario.id}-${tipo}-${montoAsignado}`}
          usuarioId={usuario.id}
          tipo={tipo}
          monto={montoAsignado}
          pending={pending}
          onSubmit={(data) => run(() => adminGuardarCreditoCliente(data))}
        />
      )}

      <section className="space-y-4 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h3 className="font-display text-xl font-bold not-italic text-movipack-deep">
          Acceso a la cuenta
        </h3>
        <p className="text-sm text-neutral-500">
          Mail para ingresar, contraseña o PIN, y si es cliente o administrador.
        </p>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => adminCambiarEmail(new FormData(e.currentTarget)));
          }}
        >
          <input type="hidden" name="id" value={usuario.id} />
          <label className={etiqueta}>
            Mail de ingreso
            <p className={ayuda}>Con este correo inicia sesión.</p>
            <input
              name="email"
              type="email"
              required
              defaultValue={usuario.email}
              key={`email-${usuario.email}`}
              className={campo}
            />
          </label>
          <button type="submit" disabled={pending} className={btn}>
            Guardar mail
          </button>
        </form>

        <form
          className="space-y-3 border-t border-neutral-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const password = String(data.get("password") ?? "");
            const repetir = String(data.get("repetir") ?? "");
            if (password !== repetir) {
              setMensaje({ error: "Las contraseñas no coinciden." });
              return;
            }
            data.set("id", usuario.id);
            run(() => adminCambiarPassword(data), { form: e.currentTarget });
          }}
        >
          <label className={etiqueta}>
            Nueva contraseña o PIN
            <p className={ayuda}>PIN de 4 a 8 números, o contraseña de al menos 8 caracteres.</p>
            <input
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className={campo}
            />
          </label>
          <label className={etiqueta}>
            Repetir contraseña
            <p className={ayuda}>Escribila de nuevo para no errarle.</p>
            <input
              name="repetir"
              type="password"
              required
              autoComplete="new-password"
              className={campo}
            />
          </label>
          <button type="submit" disabled={pending} className={btn}>
            Cambiar contraseña
          </button>
        </form>

        <form
          className="space-y-3 border-t border-neutral-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => adminCambiarRol(new FormData(e.currentTarget)));
          }}
        >
          <input type="hidden" name="id" value={usuario.id} />
          <label className={etiqueta}>
            Permiso de la cuenta
            <p className={ayuda}>
              Cliente entra al catálogo. Administrador entra al panel del local.
            </p>
            <select name="rol" defaultValue={usuario.rol} className={campo}>
              <option value="cliente">Cliente (genérico / con cuenta)</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <button type="submit" disabled={pending} className={btn}>
            Guardar permiso
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-cape">Eliminar ficha</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Borra el acceso. No borra los tickets de deuda ya cargados.
        </p>
        <button
          type="button"
          disabled={pending}
          className="mt-3 text-sm font-bold text-cape hover:underline"
          onClick={() => {
            if (!window.confirm(`¿Eliminar la cuenta de ${usuario.email}?`)) return;
            const data = new FormData();
            data.set("id", usuario.id);
            run(() => adminEliminarUsuario(data), { irALista: true });
          }}
        >
          Eliminar esta cuenta
        </button>
      </section>
    </div>
  );
}

function Dato({
  nombre,
  valor,
  detalle,
}: {
  nombre: string;
  valor: string;
  detalle: string;
}) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
        {nombre}
      </p>
      <p className="mt-1 font-display text-2xl font-bold italic text-movipack-deep">
        {valor}
      </p>
      <p className="mt-1 text-xs text-neutral-500">{detalle}</p>
    </article>
  );
}

function FormTipoCliente({
  usuarioId,
  tipo,
  monto,
  pending,
  onSubmit,
}: {
  usuarioId: string;
  tipo: TipoCuentaCliente;
  monto: number;
  pending: boolean;
  onSubmit: (data: FormData) => void;
}) {
  const [elegido, setElegido] = useState(tipo);
  const pideMonto = tieneCreditoSuper(elegido) || tieneLineaCredito(elegido);
  return (
    <form
      className="space-y-3 rounded-3xl bg-white p-5 shadow-sm sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <input type="hidden" name="id" value={usuarioId} />
      <h3 className="font-display text-xl font-bold not-italic text-movipack-deep">
        Tipo de cliente
      </h3>
      <p className="text-sm text-neutral-500">{DETALLE_TIPO_CUENTA[elegido]}</p>
      <label className={etiqueta}>
        Condición comercial
        <p className={ayuda}>Define si ve descuentos y si tiene crédito.</p>
        <select
          name="tipoCuenta"
          value={elegido}
          onChange={(e) => setElegido(parseTipoCuenta(e.target.value))}
          className={campo}
        >
          <option value="generico">Genérico (precios de lista, sin descuento)</option>
          <option value="descuentos">Con descuentos</option>
          <option value="credito_super">Crédito supermercado</option>
          <option value="linea_credito">Línea de crédito</option>
        </select>
      </label>
      {pideMonto && (
        <label className={etiqueta}>
          {tieneCreditoSuper(elegido)
            ? "Monto habilitado de supermercado"
            : "Monto de la línea de crédito"}
          <p className={ayuda}>Tope en pesos que puede usar a cuenta.</p>
          <input
            name="montoCredito"
            defaultValue={monto}
            key={`${usuarioId}-${elegido}-${monto}`}
            className={campo}
          />
        </label>
      )}
      <button type="submit" disabled={pending} className={btnFuerte}>
        Guardar tipo de cliente
      </button>
    </form>
  );
}
