"use client";

import { useState } from "react";

const INTENTOS = [
  "/recursos/web/kangoo-reparto.jpg",
  "/recursos/web/kangoo-reparto.jpeg",
  "/recursos/web/kangoo-reparto.png",
  "/recursos/web/kangoo-reparto.webp",
];

const RESPALDO = "/recursos/imagenes-productos/bolsa-kraft.jpeg";

type Props = {
  className?: string;
};

export function HeroDeliveryVisual({ className = "" }: Props) {
  const [indice, setIndice] = useState(0);

  const src = indice < INTENTOS.length ? INTENTOS[indice] : RESPALDO;

  return (
    <div
      className={`relative aspect-[4/3] w-full max-w-lg overflow-hidden rounded-3xl border border-movipack/15 bg-neutral-100 shadow-lg shadow-movipack/10 ring-1 ring-movipack/5 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Reparto MoviPack: tu pedido en movimiento"
        className="h-full w-full object-cover"
        width={800}
        height={600}
        loading="eager"
        onError={() => setIndice((n) => n + 1)}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-movipack-dark/60 via-movipack-dark/10 to-transparent" />
      <p className="absolute bottom-4 left-4 right-4 text-center text-sm font-semibold text-white drop-shadow-md sm:text-base">
        Escribinos y te pasamos lista y precios al instante
      </p>
    </div>
  );
}
