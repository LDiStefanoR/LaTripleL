import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

const RUBROS = [
  "Almacén",
  "Bebidas",
  "Limpieza",
  "Snacks y golosinas",
];

export function AboutSection() {
  return (
    <section id="sobre" className="scroll-mt-24 bg-white py-14 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-lg overflow-hidden rounded-3xl border border-movipack/15 bg-neutral-100 shadow-lg shadow-black/10">
          <Image
            src="/recursos/web/frente.png"
            alt={`Frente de ${BRAND_NAME} Minimarket en Garay 1005, Rosario`}
            fill
            className="object-cover object-[center_40%]"
            sizes="(max-width: 1024px) 100vw, 520px"
            quality={75}
            priority
          />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-cape">
            Minimarket de Rosario, online
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
            Pedís acá, te llega a casa
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-700">
            {BRAND_NAME} es un minimarket de Rosario. La gente arma el pedido
            desde esta plataforma: elige productos, ve el precio real y nos
            manda la lista. No hace falta dar una vuelta al súper para el
            almacén de todos los días.
          </p>
          <p className="mt-3 text-lg leading-relaxed text-neutral-700">
            Competimos con precio. Lo que en una cadena sale caro, acá lo
            encontrás de minimarket — y si hay promo, la ves en el carrusel y
            en el catálogo.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Rubros">
            {RUBROS.map((r) => (
              <li
                key={r}
                className="rounded-full border border-movipack/25 bg-movipack/5 px-3 py-1.5 text-sm font-semibold text-movipack-dark"
              >
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
