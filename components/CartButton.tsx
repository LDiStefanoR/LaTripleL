"use client";

import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { cantidadTotal } from "@/lib/carrito";

export function CartButton() {
  const sesion = useAuth();
  const { lineas, abrir } = useCart();
  const n = cantidadTotal(lineas);

  if (sesion?.rol === "admin") return null;

  return (
    <button
      type="button"
      onClick={abrir}
      className="relative rounded-xl border border-movipack/30 bg-white px-3 py-2 text-sm font-bold text-movipack transition hover:bg-movipack/5"
      aria-label={n ? `Carrito: ${n} artículos` : "Abrir carrito"}
    >
      Carrito
      {n > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cape px-1 text-[11px] text-white">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </button>
  );
}
