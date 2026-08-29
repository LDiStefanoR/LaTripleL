import { formatoPesos } from "@/lib/format";
import type { ProductoVitrina } from "@/types/producto";

export function PriceCompareSection({
  productos,
}: {
  productos: ProductoVitrina[];
}) {
  if (productos.length === 0) return null;

  return (
    <section
      id="precios"
      className="scroll-mt-24 border-y border-movipack/10 bg-white py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-wide text-cape">
          Competimos con precio
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
          Lo mismo, más barato que en el súper
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-neutral-700">
          Un ejemplo concreto: una Coca-Cola u otro producto de góndola suele
          salir más en el supermercado. En La Triple L el precio de calle es
          otro. El administrador carga el valor de referencia del súper junto a
          cada producto.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {productos.map((p) => {
            const superPrecio = p.precioSuper ?? 0;
            const ahorro = Math.max(0, superPrecio - p.precioMostrar);
            return (
              <li
                key={p.id}
                className="overflow-hidden rounded-2xl border border-movipack/15 bg-[#fff8ef] shadow-sm"
              >
                <div className="flex aspect-[4/3] items-center justify-center bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imagen}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 text-sm font-semibold text-neutral-800">
                    {p.nombre}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-white p-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                        En el súper
                      </p>
                      <p className="mt-1 text-sm font-bold text-neutral-400 line-through">
                        {formatoPesos(superPrecio)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-cape p-2 text-white">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">
                        Triple L
                      </p>
                      <p className="mt-1 text-sm font-extrabold">
                        {formatoPesos(p.precioMostrar)}
                      </p>
                    </div>
                  </div>
                  {ahorro > 0 && (
                    <p className="mt-3 text-center text-sm font-bold text-movipack-dark">
                      Ahorrás {formatoPesos(ahorro)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
