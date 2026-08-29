"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adminCambiarEstadoCuenta,
  adminCrearUsuario,
  type EstadoAdminCuentas,
} from "@/app/acciones/cuentas";
import { formatoPesos } from "@/lib/format";
import { semaforoDeuda } from "@/lib/deuda";
import { resumenOperativoFicha } from "@/lib/ficha-cliente";
import { ETIQUETA_TIPO_CUENTA, parseTipoCuenta } from "@/lib/tipo-cuenta";
import { normalizarEmailLogin } from "@/lib/auth-config";
import type { UsuarioPublico } from "@/types/auth";
import type { ResumenCliente } from "@/types/cuenta";
import type { Pedido } from "@/types/pedido";

const TONO = {
  verde: "border-emerald-300 bg-emerald-50/80",
  amarillo: "border-amber-300 bg-amber-50",
  rojo: "border-red-300 bg-red-50",
} as const;

const PUNTO = {
  verde: "bg-emerald-500",
  amarillo: "bg-amber-400",
  rojo: "bg-red-500",
} as const;

export function AdminClientesLista({
  usuarios,
  resumenes,
  pedidos,
}: {
  usuarios: UsuarioPublico[];
  resumenes: ResumenCliente[];
  pedidos: Pedido[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [ver, setVer] = useState<"clientes" | "pendiente" | "todos">("clientes");
  const [mensaje, setMensaje] = useState<EstadoAdminCuentas>(null);
  const [pending, start] = useTransition();

  const porEmail = useMemo(() => {
    const map = new Map<string, ResumenCliente>();
    for (const r of resumenes) map.set(normalizarEmailLogin(r.cliente.email), r);
    return map;
  }, [resumenes]);

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    const tel = t.replace(/\D/g, "");
    return usuarios.filter((u) => {
      if (ver === "clientes" && u.rol !== "cliente") return false;
      if (ver === "pendiente" && u.estado !== "pendiente") return false;
      if (!t) return true;
      const telefono = (u.perfil?.telefono ?? "").replace(/\D/g, "");
      const blob = [
        u.nombre,
        u.email,
        u.perfil?.direccion,
        u.perfil?.telefono,
        u.notaInterna,
      ]
        .join(" ")
        .toLowerCase();
      if (blob.includes(t)) return true;
      if (tel && telefono.includes(tel)) return true;
      return false;
    });
  }, [usuarios, q, ver]);

  const solicitudes = usuarios.filter((u) => u.estado === "pendiente").length;

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap gap-2">
        <Filtro activa={ver === "clientes"} onClick={() => setVer("clientes")} texto="Clientes" />
        <Filtro
          activa={ver === "pendiente"}
          onClick={() => setVer("pendiente")}
          texto={`Solicitudes (${solicitudes})`}
        />
        <Filtro activa={ver === "todos"} onClick={() => setVer("todos")} texto="Todos" />
      </div>

      <label className="block text-sm font-bold text-movipack-deep">
        Buscar ficha
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, mail, teléfono o dirección"
          className="mt-1 w-full rounded-xl border border-movipack/20 px-3 py-2.5 text-sm outline-none focus:border-movipack"
        />
      </label>
      <p className="text-sm text-neutral-500">
        {lista.length} ficha{lista.length === 1 ? "" : "s"}. Pinchá para abrirla.
      </p>

      <AltaFicha
        pending={pending}
        onCrear={(data, form) => {
          setMensaje(null);
          start(async () => {
            const r = await adminCrearUsuario(data);
            setMensaje(r);
            if (r?.ok) {
              form.reset();
              router.refresh();
            }
          });
        }}
      />

      <ul className="space-y-2">
        {lista.length === 0 && (
          <li className="rounded-2xl bg-white p-4 text-sm text-neutral-600 shadow-sm">
            No hay fichas con esa búsqueda.
          </li>
        )}
        {lista.map((usuario) => {
          const fiado = porEmail.get(normalizarEmailLogin(usuario.email)) ?? null;
          const pedidosCli = pedidos.filter(
            (p) =>
              p.usuarioId === usuario.id ||
              normalizarEmailLogin(p.contacto.email) ===
                normalizarEmailLogin(usuario.email),
          );
          const stats = resumenOperativoFicha(usuario, fiado, pedidosCli);
          const semaforo = semaforoDeuda(fiado?.ticketsVigentes ?? []);
          const tipo = parseTipoCuenta(usuario.tipoCuenta);
          return (
            <li key={usuario.id}>
              <div
                className={`rounded-2xl border px-4 py-3 shadow-sm ${
                  usuario.rol === "admin" ? "border-movipack/15 bg-white" : TONO[semaforo]
                }`}
              >
                <Link href={`/admin/clientes/${usuario.id}`} className="block">
                  <p className="flex items-center gap-2 font-bold text-movipack-deep">
                    {usuario.rol !== "admin" && (
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${PUNTO[semaforo]}`} />
                    )}
                    {usuario.nombre}
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-600">{usuario.email}</p>
                  <p className="mt-0.5 text-sm text-neutral-600">
                    {usuario.rol === "admin"
                      ? "Administrador"
                      : ETIQUETA_TIPO_CUENTA[tipo]}
                    {usuario.estado === "pendiente" ? " · Solicitud pendiente" : ""}
                    {usuario.perfil?.telefono ? ` · ${usuario.perfil.telefono}` : ""}
                    {usuario.perfil?.direccion ? ` · ${usuario.perfil.direccion}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-movipack-deep">
                    Vendido {formatoPesos(stats.vendido)}
                    {" · "}
                    {stats.comprobantes} comprobante{stats.comprobantes === 1 ? "" : "s"}
                    {" · Deuda "}
                    {formatoPesos(stats.deuda)}
                  </p>
                </Link>
                {usuario.estado === "pendiente" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-lg bg-movipack px-3 py-2 text-sm font-bold text-white"
                      onClick={() => {
                        const data = new FormData();
                        data.set("id", usuario.id);
                        data.set("estado", "activa");
                        setMensaje(null);
                        start(async () => {
                          const r = await adminCambiarEstadoCuenta(data);
                          setMensaje(r);
                          if (r?.ok) router.refresh();
                        });
                      }}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-lg border border-cape px-3 py-2 text-sm font-bold text-cape"
                      onClick={() => {
                        const data = new FormData();
                        data.set("id", usuario.id);
                        data.set("estado", "rechazada");
                        setMensaje(null);
                        start(async () => {
                          const r = await adminCambiarEstadoCuenta(data);
                          setMensaje(r);
                          if (r?.ok) router.refresh();
                        });
                      }}
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Filtro({
  activa,
  onClick,
  texto,
}: {
  activa: boolean;
  onClick: () => void;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold ${
        activa
          ? "border-movipack-dark bg-movipack text-white"
          : "border-neutral-300 bg-white text-neutral-700"
      }`}
    >
      {texto}
    </button>
  );
}

function AltaFicha({
  pending,
  onCrear,
}: {
  pending: boolean;
  onCrear: (data: FormData, form: HTMLFormElement) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const campo =
    "mt-1 w-full rounded-xl border border-movipack/20 px-3 py-2 text-sm outline-none focus:border-movipack";
  if (!abierta) {
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="rounded-xl border border-movipack/30 px-4 py-2 text-sm font-bold text-movipack"
      >
        Nueva ficha
      </button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onCrear(new FormData(e.currentTarget), e.currentTarget);
      }}
    >
      <p className="text-sm font-bold text-movipack-deep">Nueva ficha de cliente</p>
      <label className="block text-sm font-bold text-movipack-deep">
        Nombre o razón social
        <input name="nombre" required className={campo} />
      </label>
      <label className="block text-sm font-bold text-movipack-deep">
        Mail de ingreso
        <input name="email" type="email" required className={campo} />
      </label>
      <label className="block text-sm font-bold text-movipack-deep">
        Contraseña o PIN
        <input name="password" required className={campo} />
      </label>
      <input type="hidden" name="rol" value="cliente" />
      <input type="hidden" name="tipoCuenta" value="generico" />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-movipack px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          Crear ficha
        </button>
        <button
          type="button"
          className="text-sm font-bold text-neutral-500"
          onClick={() => setAbierta(false)}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
