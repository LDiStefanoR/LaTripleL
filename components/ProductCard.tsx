"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { etiquetaRubro } from "@/lib/categorias";
import { formatoPesos, nombreVitrina, unidadProducto } from "@/lib/format";
import { avisoCantidadPromo, ETIQUETA_OFERTA } from "@/lib/oferta";
import type { ProductoVitrina } from "@/types/producto";

type Props = { producto: ProductoVitrina; etiqueta?: string };

export function ProductCard({ producto, etiqueta }: Props) {
  const sesion = useAuth();
  const { lineas, agregar, setCantidad } = useCart();
  const [broken, setBroken] = useState(false);
  const cantidad = lineas.find((l) => l.id === producto.id)?.cantidad ?? 0;
  const unidad = unidadProducto(producto.nombre);
  const hayDto = producto.precioLista > producto.precioMostrar;
  const pct =
    hayDto && producto.precioLista > 0
      ? Math.round(
          (1 - producto.precioMostrar / producto.precioLista) * 100,
        )
      : 0;

  useEffect(() => {
    setBroken(false);
  }, [producto.imagen]);

  const esAdmin = sesion?.rol === "admin";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-movipack/30 hover:shadow-md">
      <div className="relative aspect-square bg-white">
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={producto.imagen}
            src={producto.imagen}
            alt={producto.nombre}
            className="h-full w-full object-contain p-3"
            width={400}
            height={400}
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-neutral-50 text-3xl">
            🛒
          </div>
        )}
        {hayDto && pct > 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-cape px-1.5 py-0.5 text-[11px] font-bold text-white">
            -{pct}%
          </span>
        )}
        {producto.tipoPromo === "2x1" || producto.tipoPromo === "3x2" ? (
          <span className="absolute right-2 top-2 rounded-md bg-confetti px-1.5 py-0.5 text-[11px] font-extrabold text-neutral-900">
            {ETIQUETA_OFERTA[producto.tipoPromo]}
          </span>
        ) : producto.esPromo ? (
          <span className="absolute right-2 top-2 rounded-md bg-confetti px-1.5 py-0.5 text-[11px] font-extrabold text-neutral-900">
            PROMO
          </span>
        ) : producto.enCombo ? (
          <span className="absolute right-2 top-2 rounded-md bg-confetti px-1.5 py-0.5 text-[11px] font-extrabold text-neutral-900">
            COMBO
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3 pt-1">
        <p className="min-h-10 text-[13px] font-medium leading-snug text-neutral-800 line-clamp-2">
          {nombreVitrina(producto.nombre)}
        </p>
        <p className="text-[11px] text-neutral-400">
          {etiqueta ?? etiquetaRubro(producto.seccion)}
          {unidad ? ` · ${unidad}` : ""}
        </p>

        <div className="mt-auto pt-1">
          {hayDto ? (
            <div className="flex flex-wrap items-baseline gap-1.5">
              <p className="text-lg font-extrabold tabular-nums leading-none text-cape">
                {formatoPesos(producto.precioMostrar)}
              </p>
              <p className="text-xs font-semibold text-neutral-400 line-through">
                {formatoPesos(producto.precioLista)}
              </p>
            </div>
          ) : (
            <p className="text-lg font-extrabold tabular-nums leading-none text-neutral-900">
              {formatoPesos(producto.precioMostrar)}
            </p>
          )}
          {producto.tipoPromo === "2x1" || producto.tipoPromo === "3x2" ? (
            <p className="mt-1 text-[11px] font-bold text-cape">
              {avisoCantidadPromo(producto.tipoPromo)}
            </p>
          ) : null}
          {producto.notaAdmin && (
            <p className="mt-1 text-[10px] font-semibold text-cape">
              {producto.notaAdmin}
            </p>
          )}
        </div>

        {!esAdmin && (
          <div className="mt-2">
            {cantidad < 1 ? (
              <button
                type="button"
                onClick={() => agregar(producto, { abrir: false })}
                className="flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-cape text-sm font-bold text-white transition hover:brightness-110"
              >
                <span className="text-lg leading-none">+</span>
                Agregar
              </button>
            ) : (
              <div className="flex h-10 items-center justify-between rounded-lg border-2 border-cape bg-white">
                <button
                  type="button"
                  aria-label="Quitar una unidad"
                  onClick={() => setCantidad(producto.id, cantidad - 1)}
                  className="flex h-full w-10 items-center justify-center text-lg font-bold text-cape"
                >
                  −
                </button>
                <span className="min-w-6 text-center text-sm font-extrabold tabular-nums text-neutral-900">
                  {cantidad}
                </span>
                <button
                  type="button"
                  aria-label="Agregar una unidad"
                  onClick={() => agregar(producto, { abrir: false })}
                  className="flex h-full w-10 items-center justify-center text-lg font-bold text-cape"
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
