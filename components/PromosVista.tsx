"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { ComboCard } from "@/components/ComboCard";
import {
  adminQuitarAfiche,
  adminSubirAfiche,
  type EstadoPromo,
} from "@/app/acciones/promos";
import type { ComboVitrina } from "@/lib/combo";
import type { ProductoVitrina } from "@/types/producto";
import type { AfichePromo } from "@/types/promo";

export function PromosVista({
  destacadas,
  combos,
  afiches,
  esAdmin,
}: {
  destacadas: ProductoVitrina[];
  combos: ComboVitrina[];
  afiches: AfichePromo[];
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoPromo>(null);
  const [pending, start] = useTransition();
  const nxm = destacadas.filter(
    (p) => p.tipoPromo === "2x1" || p.tipoPromo === "3x2",
  );
  const otras = destacadas.filter(
    (p) => p.tipoPromo !== "2x1" && p.tipoPromo !== "3x2",
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-cape">
        Promos
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold italic text-movipack-deep sm:text-5xl">
        Ofertas de la semana
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Primero las 2x1 y 3x2. Abajo, los afiches grandes de la semana.
      </p>

      {esAdmin && (
        <section className="mt-8 rounded-3xl border border-dashed border-movipack/40 bg-white p-5">
          <h2 className="font-display text-xl font-bold not-italic text-movipack-deep">
            Cargar afiche A4
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Subí acá las imágenes de Gemini, tamaño A4. Quedan grandes, una
            debajo de la otra, ocupando el cuerpo de la página.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              setMensaje(null);
              start(async () => {
                const r = await adminSubirAfiche(new FormData(form));
                setMensaje(r);
                if (r?.ok) {
                  form.reset();
                  router.refresh();
                }
              });
            }}
          >
            <input
              type="file"
              name="imagen"
              accept="image/jpeg,image/png,image/webp"
              required
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-movipack file:px-3 file:py-1.5 file:font-bold file:text-white"
            />
            <button
              type="submit"
              disabled={pending}
              className="block rounded-xl bg-movipack px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {pending ? "Subiendo…" : "Publicar afiche"}
            </button>
          </form>
          {mensaje?.error && (
            <p className="mt-2 text-sm font-semibold text-cape">{mensaje.error}</p>
          )}
          {mensaje?.ok && (
            <p className="mt-2 text-sm font-semibold text-emerald-700">{mensaje.ok}</p>
          )}
        </section>
      )}

      {combos.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold not-italic text-movipack-deep">
            Combos
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            2 o 3 productos juntos. El descuento se aplica en el carrito.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {combos.map((c) => (
              <ComboCard key={c.id} combo={c} />
            ))}
          </div>
        </section>
      )}

      {nxm.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold not-italic text-movipack-deep">
            Destacadas
          </h2>
          <p className="mt-1 text-sm text-neutral-500">2x1 y 3x2 de la semana</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {nxm.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        </section>
      )}

      {otras.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold not-italic text-movipack-deep">
            También en promo
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {otras.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 space-y-10">
        {afiches.length === 0 && nxm.length === 0 && otras.length === 0 && combos.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-neutral-600 shadow-sm">
            Esta semana todavía no hay promociones cargadas.
          </p>
        )}
        {afiches.map((a) => (
          <article
            key={a.id}
            className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.imagen}
              alt="Promo A4"
              className="mx-auto h-auto w-full object-contain"
            />
            {esAdmin && (
              <button
                type="button"
                disabled={pending}
                className="w-full py-3 text-sm font-bold text-cape hover:bg-red-50"
                onClick={() => {
                  const data = new FormData();
                  data.set("id", a.id);
                  setMensaje(null);
                  start(async () => {
                    const r = await adminQuitarAfiche(data);
                    setMensaje(r);
                    if (r?.ok) router.refresh();
                  });
                }}
              >
                Quitar afiche
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
