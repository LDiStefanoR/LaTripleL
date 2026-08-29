"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registrar, type EstadoAuth } from "@/app/acciones/auth";
import { ETIQUETA_FRANJA } from "@/types/pedido";

const campo =
  "w-full rounded-xl border border-movipack/20 bg-white px-4 py-3 outline-none ring-movipack/30 focus:border-movipack focus:ring-2";

export function RegisterForm() {
  const [estado, action, pending] = useActionState<EstadoAuth, FormData>(
    registrar,
    null,
  );

  if (estado?.ok) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-semibold text-emerald-900">{estado.ok}</p>
        <Link
          href="/ingresar"
          className="inline-flex font-bold text-movipack hover:underline"
        >
          Ir a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          Nombre o razón social
        </span>
        <input name="nombre" required minLength={2} autoComplete="name" className={campo} />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-neutral-700">
          ¿Sos persona o empresa?
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="tipoPersona" value="persona" required defaultChecked />
          Persona
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="tipoPersona" value="empresa" />
          Empresa
        </label>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          Tipo de compra
        </span>
        <input
          name="tipoLocal"
          required
          minLength={2}
          placeholder="Ej: vecino, comercio, oficina"
          className={campo}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          ¿Qué productos te interesan?
        </span>
        <textarea
          name="productosInteres"
          required
          minLength={3}
          rows={3}
          placeholder="Contanos qué sueles comprar"
          className={campo}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          Dirección
        </span>
        <input name="direccion" required minLength={5} autoComplete="street-address" className={campo} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          Teléfono
        </span>
        <input name="telefono" required minLength={8} autoComplete="tel" className={campo} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          Mail
        </span>
        <input type="email" name="email" required autoComplete="email" className={campo} />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-neutral-700">
          Franja de entrega
        </legend>
        <p className="text-xs text-neutral-500">
          En qué horario preferís que te llevemos el pedido.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-movipack/20 px-3 py-3 text-sm">
            <input type="radio" name="franjaReparto" value="manana" required />
            {ETIQUETA_FRANJA.manana}
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-movipack/20 px-3 py-3 text-sm">
            <input type="radio" name="franjaReparto" value="tarde" required />
            {ETIQUETA_FRANJA.tarde}
          </label>
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          Contraseña
        </span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={campo}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          Repetir contraseña
        </span>
        <input
          type="password"
          name="repetir"
          required
          minLength={8}
          autoComplete="new-password"
          className={campo}
        />
      </label>

      {estado?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-cape">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-cape px-4 py-3 text-sm font-bold text-white shadow-md shadow-red-500/20 disabled:opacity-60"
      >
        {pending ? "Enviando solicitud…" : "Enviar solicitud"}
      </button>
      <p className="text-center text-sm text-neutral-600">
        El administrador tiene que aceptar tu cuenta antes de que puedas
        ingresar.{" "}
        <Link href="/ingresar" className="font-semibold text-movipack hover:underline">
          Ya tengo cuenta
        </Link>
      </p>
    </form>
  );
}
