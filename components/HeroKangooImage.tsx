"use client";

import { useState } from "react";

const KANGOO_CANDIDATES = [
  "/recursos/web/kangoo-reparto.jpg",
  "/recursos/web/kangoo-reparto.jpeg",
  "/recursos/web/kangoo-reparto.webp",
  "/recursos/web/kangoo-reparto.png",
] as const;

const FALLBACK = "/recursos/imagenes-productos/bolsa-kraft.jpeg";

/**
 * Usa la foto del Kangoo en `recursos/web/kangoo-reparto` (cualquier extensión de la lista).
 * Si no está, cae al catálogo para no dejar el hero vacío.
 */
export function HeroKangooImage() {
  const [index, setIndex] = useState(0);
  const src = index < KANGOO_CANDIDATES.length ? KANGOO_CANDIDATES[index] : FALLBACK;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Reparto MoviPack en Kangoo: llevamos tu pedido donde lo necesites"
      className="h-full w-full object-cover"
      width={800}
      height={600}
      loading="eager"
      decoding="async"
      onError={() => {
        setIndex((i) => (i < KANGOO_CANDIDATES.length ? i + 1 : i));
      }}
    />
  );
}
