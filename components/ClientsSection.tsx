const PILARES = [
  {
    titulo: "Almacén",
    texto: "Yerba, azúcar, fideos, latas y lo básico para la cocina de todos los días.",
  },
  {
    titulo: "Bebidas",
    texto: "Gaseosas, aguas, jugos y cerveza para el asado o el kiosco de la esquina.",
  },
  {
    titulo: "Limpieza",
    texto: "Lavandina, detergente e higiene personal, sin dar una vuelta de más.",
  },
  {
    titulo: "Golosinas y snacks",
    texto: "Galletitas, chocolates y picadas para el recreo o la visita.",
  },
];

export function ClientsSection() {
  return (
    <section className="border-y border-movipack/10 bg-[#fff6ea] py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-wide text-cape">
          En el local
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
          Lo que encontrás en góndola
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILARES.map((c) => (
            <article
              key={c.titulo}
              className="rounded-2xl border border-movipack/15 bg-white p-5 shadow-sm"
            >
              <h3 className="font-display text-xl font-semibold not-italic text-movipack-deep">
                {c.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {c.texto}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
