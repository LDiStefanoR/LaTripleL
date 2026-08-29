"use client";

import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { avisoCombo } from "@/lib/combo";
import { formatoPesos, nombreVitrina } from "@/lib/format";
import type { ComboVitrina } from "@/lib/combo";

export function ComboCard({ combo }: { combo: ComboVitrina }) {
  const sesion = useAuth();
  const { agregarCombo } = useCart();
  const esAdmin = sesion?.rol === "admin";
  const n = combo.productos.length;
  const hayDto = combo.precioLista > combo.precioPagar;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-confetti bg-white shadow-sm">
      <div className={`relative grid gap-px bg-neutral-100 ${n === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {combo.productos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={p.imagen}
            alt={p.nombre}
            className="h-28 w-full bg-white object-contain p-2 sm:h-32"
          />
        ))}
        <span className="absolute left-2 top-2 rounded-md bg-confetti px-1.5 py-0.5 text-[11px] font-extrabold text-neutral-900">
          COMBO {n}×1
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3 pt-2">
        <ul className="space-y-0.5">
          {combo.productos.map((p) => (
            <li
              key={p.id}
              className="truncate text-[13px] font-medium text-neutral-800"
            >
              {nombreVitrina(p.nombre)}
            </li>
          ))}
        </ul>
        <p className="text-[11px] font-bold text-cape">
          {avisoCombo(n, combo.precioCombo)}
        </p>
        <div className="mt-auto pt-1">
          {hayDto ? (
            <div className="flex flex-wrap items-baseline gap-1.5">
              <p className="text-lg font-extrabold tabular-nums leading-none text-cape">
                {formatoPesos(combo.precioPagar)}
              </p>
              <p className="text-xs font-semibold text-neutral-400 line-through">
                {formatoPesos(combo.precioLista)}
              </p>
            </div>
          ) : (
            <p className="text-lg font-extrabold tabular-nums leading-none text-neutral-900">
              {formatoPesos(combo.precioPagar)}
            </p>
          )}
        </div>
        {!esAdmin && (
          <button
            type="button"
            onClick={() => agregarCombo(combo.productos)}
            className="mt-2 flex h-10 w-full items-center justify-center rounded-lg bg-cape text-sm font-bold text-white transition hover:brightness-110"
          >
            Agregar combo
          </button>
        )}
      </div>
    </article>
  );
}
