"use client";

import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { cantidadTotal } from "@/lib/carrito";

export function CartButton() {
  const sesion = useAuth();
  const { lineas, abrir } = useCart();
  const n = cantidadTotal(lineas);

  if (sesion?.rol === "admin" || sesion?.rol === "caja") return null;

  return (
    <button
      type="button"
      onClick={abrir}
      className="relative inline-flex h-10 items-center justify-center rounded-xl border border-movipack/30 bg-white px-2.5 text-sm font-bold text-movipack touch-manipulation transition hover:bg-movipack/5 sm:px-3"
      aria-label={n ? `Carrito: ${n} artículos` : "Abrir carrito"}
    >
      <span className="sm:hidden" aria-hidden>
        🛒
      </span>
      <span className="hidden sm:inline">Carrito</span>
      {n > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cape px-1 text-[11px] text-white">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </button>
  );
}
