"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import type { ProductoVitrina } from "@/types/producto";

export function PromoCarousel({ productos }: { productos: ProductoVitrina[] }) {
  const pista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = pista.current;
    if (!el || productos.length < 2) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const card = el.firstElementChild as HTMLElement | null;
      const paso = card ? card.offsetWidth + 16 : 280;
      const max = el.scrollWidth - el.clientWidth;
      const siguiente = el.scrollLeft + paso;
      el.scrollTo({
        left: siguiente >= max - 8 ? 0 : siguiente,
        behavior: "smooth",
      });
    }, 4200);
    return () => window.clearInterval(id);
  }, [productos.length]);

  if (productos.length === 0) {
    return (
      <section id="promos" className="scroll-mt-24 bg-[#fff6ea] py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-wide text-cape">
            Promos
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep">
            Esta semana no hay promociones cargadas
          </h2>
          <p className="mt-3 max-w-xl text-neutral-600">
            El administrador carga las promos y acá aparecen las de la semana.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="promos" className="scroll-mt-24 bg-[#fff6ea] py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-cape">
              Promos de la semana
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
              Precios que no ves en el súper
            </h2>
            <p className="mt-2 max-w-xl text-neutral-600">
              Productos destacados de la semana. El precio de lista es el que
              ves sin cuenta; si te habilitan descuentos, aparece tu precio en rojo.
            </p>
          </div>
          <Link
            href="/promos"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-movipack px-4 text-sm font-bold text-movipack"
          >
            Ver todas las promos
          </Link>
        </div>

        <div
          ref={pista}
          className="promo-track mt-8"
          aria-label="Carrusel de productos en promoción"
        >
          {productos.map((p) => (
            <div key={p.id} className="promo-slide">
              <ProductCard producto={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
