import { whatsappUrl } from "@/lib/whatsapp";

const CANALES = [
  "Envío a todo Rosario",
  "Mañana de 9 a 13",
  "Tarde de 18 a 20",
  "Cadetería privada",
  "Apps y plataformas",
  "Retiro en Garay 1005",
] as const;

export function DeliverySection() {
  const wa = whatsappUrl(
    "Hola La Triple L, quiero un pedido con envío a domicilio en Rosario.",
  );

  return (
    <section
      id="reparto"
      className="scroll-mt-24 border-y border-movipack/10 bg-white py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wide text-movipack">
            Envíos
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-movipack-deep sm:text-4xl">
            Llegamos a todo Rosario
          </h2>
          <p className="mt-4 text-lg text-neutral-700">
            Hacés el pedido en la web y coordinamos la entrega. Los repartos
            llegan en dos franjas: de 9 a 13 o de 18 a 20. Trabajamos con
            cadetería privada y con distintas plataformas, según la zona. Si
            estás cerca, también podés pasar a buscarlo al local.
          </p>
          <p className="mt-3 text-lg text-neutral-700">
            Al confirmar el pedido te decimos el costo de envío y el tiempo
            estimado. Si te registrás y te habilitan descuentos, ves precios de cliente.
          </p>
        </div>

        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Formas de entrega">
          {CANALES.map((z) => (
            <li
              key={z}
              className="rounded-full border border-movipack/25 bg-movipack/5 px-3 py-1.5 text-sm font-semibold text-movipack-dark"
            >
              {z}
            </li>
          ))}
        </ul>
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-cape px-5 text-sm font-bold text-white shadow-md shadow-red-500/25 transition hover:brightness-110"
        >
          Coordinar un envío
        </a>
      </div>
    </section>
  );
}
