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

  const esStaff = sesion?.rol === "admin" || sesion?.rol === "caja";
  const agotado = producto.stock === 0;

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-movipack/30 hover:shadow-md">
      <div className="relative aspect-square bg-white">
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={producto.imagen}
            src={producto.imagen}
            alt={producto.nombre}
            className="h-full w-full object-contain p-2 sm:p-3"
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
          <span className="absolute left-1.5 top-1.5 rounded-md bg-cape px-1.5 py-0.5 text-[10px] font-bold text-white sm:left-2 sm:top-2 sm:text-[11px]">
            -{pct}%
          </span>
        )}
        {producto.tipoPromo === "2x1" || producto.tipoPromo === "3x2" ? (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-confetti px-1.5 py-0.5 text-[10px] font-extrabold text-neutral-900 sm:right-2 sm:top-2 sm:text-[11px]">
            {ETIQUETA_OFERTA[producto.tipoPromo]}
          </span>
        ) : producto.esPromo ? (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-confetti px-1.5 py-0.5 text-[10px] font-extrabold text-neutral-900 sm:right-2 sm:top-2 sm:text-[11px]">
            PROMO
          </span>
        ) : producto.enCombo ? (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-confetti px-1.5 py-0.5 text-[10px] font-extrabold text-neutral-900 sm:right-2 sm:top-2 sm:text-[11px]">
            COMBO
          </span>
        ) : null}
        {agotado && (
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-neutral-900 px-1.5 py-0.5 text-[10px] font-extrabold text-white sm:bottom-2 sm:left-2 sm:text-[11px]">
            SIN STOCK
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-2.5 pt-1 sm:gap-1.5 sm:px-3 sm:pb-3">
        <p className="min-h-9 text-[12px] font-medium leading-snug text-neutral-800 line-clamp-2 sm:min-h-10 sm:text-[13px]">
          {nombreVitrina(producto.nombre)}
        </p>
        <p className="text-[10px] text-neutral-400 sm:text-[11px]">
          {etiqueta ?? etiquetaRubro(producto.seccion)}
          {unidad ? ` · ${unidad}` : ""}
        </p>

        <div className="mt-auto pt-1">
          {hayDto ? (
            <div className="flex flex-wrap items-baseline gap-1 sm:gap-1.5">
              <p className="text-base font-extrabold tabular-nums leading-none text-cape sm:text-lg">
                {formatoPesos(producto.precioMostrar)}
              </p>
              <p className="text-[11px] font-semibold text-neutral-400 line-through sm:text-xs">
                {formatoPesos(producto.precioLista)}
              </p>
            </div>
          ) : (
            <p className="text-base font-extrabold tabular-nums leading-none text-neutral-900 sm:text-lg">
              {formatoPesos(producto.precioMostrar)}
            </p>
          )}
          {producto.tipoPromo === "2x1" || producto.tipoPromo === "3x2" ? (
            <p className="mt-1 text-[11px] font-bold text-cape">
              {avisoCantidadPromo(producto.tipoPromo)}
            </p>
          ) : null}
          {typeof producto.stock === "number" && (
            <p className={`mt-1 text-[10px] font-bold sm:text-[11px] ${agotado ? "text-cape" : "text-neutral-500"}`}>
              {agotado ? "Sin stock" : `Stock ${producto.stock}`}
            </p>
          )}
          {producto.notaAdmin && (
            <p className="mt-1 text-[10px] font-semibold text-cape">
              {producto.notaAdmin}
            </p>
          )}
        </div>

        {!esStaff && (
          <div className="mt-2">
            {agotado ? (
              <p className="flex h-11 w-full items-center justify-center rounded-lg bg-neutral-200 text-sm font-bold text-neutral-500 sm:h-10">
                Sin stock
              </p>
            ) : cantidad < 1 ? (
              <button
                type="button"
                onClick={() => agregar(producto, { abrir: false })}
                className="flex h-11 w-full items-center justify-center gap-1 rounded-lg bg-cape text-sm font-bold text-white touch-manipulation transition hover:brightness-110 active:scale-[0.98] sm:h-10"
              >
                <span className="text-lg leading-none">+</span>
                Agregar
              </button>
            ) : (
              <div className="flex h-11 items-center justify-between rounded-lg border-2 border-cape bg-white sm:h-10">
                <button
                  type="button"
                  aria-label="Quitar una unidad"
                  onClick={() => setCantidad(producto.id, cantidad - 1)}
                  className="flex h-full min-w-11 items-center justify-center text-xl font-bold text-cape touch-manipulation active:bg-cape/10 sm:w-10 sm:text-lg"
                >
                  −
                </button>
                <span className="min-w-6 text-center text-sm font-extrabold tabular-nums text-neutral-900">
                  {cantidad}
                </span>
                <button
                  type="button"
                  aria-label="Agregar una unidad"
                  disabled={typeof producto.stock === "number" && cantidad >= producto.stock}
                  onClick={() => agregar(producto, { abrir: false })}
                  className="flex h-full min-w-11 items-center justify-center text-xl font-bold text-cape touch-manipulation active:bg-cape/10 disabled:opacity-30 sm:w-10 sm:text-lg"
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
