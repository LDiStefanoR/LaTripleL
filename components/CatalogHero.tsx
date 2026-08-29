import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

type Props = { total: number };

export function CatalogHero({ total }: Props) {
  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow absolute inset-0" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl space-y-4 text-white">
          <p className="text-sm font-bold uppercase tracking-wide text-confetti">
            Catálogo
          </p>
          <h1 className="font-display text-4xl font-bold italic leading-tight sm:text-5xl">
            Todo lo que hay
            <span className="block not-italic">en el minimarket</span>
          </h1>
          <p className="text-lg text-white/90">
            {total} productos con precio de lista. Filtrá por rubro, buscá por
            nombre y consultá por WhatsApp.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
        <div className="rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
          <BrandLogo variant="showcase" className="max-h-40 w-auto" />
        </div>
      </div>
    </section>
  );
}
