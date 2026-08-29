"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { ingresar, type EstadoAuth } from "@/app/acciones/auth";

const CLAVE_USUARIO = "latriplel-usuario-recordado";

export function LoginForm() {
  const [estado, action, pending] = useActionState<EstadoAuth, FormData>(
    ingresar,
    null,
  );
  const [login, setLogin] = useState("");
  const [recordar, setRecordar] = useState(false);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_USUARIO);
      if (guardado) {
        setLogin(guardado);
        setRecordar(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function onSubmit(formData: FormData) {
    const valor = String(formData.get("login") ?? "").trim();
    const quiereRecordar = formData.get("recordar") === "1";
    try {
      if (quiereRecordar && valor) {
        localStorage.setItem(CLAVE_USUARIO, valor);
      } else {
        localStorage.removeItem(CLAVE_USUARIO);
      }
    } catch {
      /* ignore */
    }
    return action(formData);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          Teléfono o mail
        </span>
        <input
          type="text"
          name="login"
          required
          autoComplete="username"
          inputMode="email"
          placeholder="3415402089 o tu mail"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="w-full rounded-xl border border-movipack/20 bg-white px-4 py-3 outline-none ring-movipack/30 focus:border-movipack focus:ring-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">
          PIN o contraseña
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="PIN de 4 números o tu clave"
          className="w-full rounded-xl border border-movipack/20 bg-white px-4 py-3 outline-none ring-movipack/30 focus:border-movipack focus:ring-2"
        />
      </label>
      <label className="flex cursor-pointer items-center gap-3 select-none">
        <input
          type="checkbox"
          name="recordar"
          value="1"
          checked={recordar}
          onChange={(e) => setRecordar(e.target.checked)}
          className="h-4 w-4 rounded border-movipack/40 text-movipack accent-movipack"
        />
        <span className="text-sm font-semibold text-neutral-700">
          Recordar usuario
        </span>
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
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
      <p className="text-center text-sm text-neutral-600">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="font-semibold text-movipack hover:underline">
          Registrate
        </Link>
      </p>
    </form>
  );
}
