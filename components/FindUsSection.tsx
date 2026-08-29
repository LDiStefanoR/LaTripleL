import {
  ADDRESS_FULL,
  ADDRESS_LINE,
  HOURS_DETAIL,
  MAPS_EMBED_SRC,
  MAPS_SHARE_URL,
} from "@/lib/brand";

export function FindUsSection() {
  return (
    <section
      id="donde"
      className="scroll-mt-24 border-t border-movipack/10 bg-white py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-wide text-cape">
          Dónde encontrarnos
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
          Garay 1005, Rosario
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-neutral-700">
          Estamos en el barrio. Pedí con envío a Rosario o pasá a buscar a
          Garay 1005.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-movipack/15 bg-[#fff6ea] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wide text-movipack">
              Dirección
            </p>
            <p className="mt-2 font-display text-2xl font-semibold not-italic text-movipack-deep">
              {ADDRESS_LINE}
            </p>
            <p className="mt-1 text-neutral-600">Rosario, Santa Fe, Argentina</p>
            <p className="mt-6 text-sm text-neutral-600">{HOURS_DETAIL}</p>
            <a
              href={MAPS_SHARE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-cape px-5 text-sm font-bold text-white shadow-md shadow-red-500/25 transition hover:brightness-110"
            >
              Cómo llegar
            </a>
          </div>

          <div className="overflow-hidden rounded-3xl border border-movipack/15 shadow-lg shadow-black/5">
            <div className="aspect-[4/3] min-h-[280px] w-full">
              <iframe
                title={`Mapa: ${ADDRESS_FULL}`}
                src={MAPS_EMBED_SRC}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
