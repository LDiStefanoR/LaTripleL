import { BrandLogo } from "@/components/BrandLogo";
import { HeroDeliveryVisual } from "@/components/HeroDeliveryVisual";

/**
 * Columna derecha del hero: logo en grande + foto de reparto.
 */
export function HeroVisualColumn() {
  return (
    <div className="flex w-full max-w-xl flex-col items-stretch gap-6 lg:max-w-[min(100%,520px)] lg:flex-1 lg:items-end xl:max-w-[560px]">
      <div className="relative w-full overflow-hidden rounded-3xl border border-movipack/20 bg-gradient-to-b from-white via-movipack/5 to-movipack/10 px-6 py-10 shadow-xl shadow-movipack/15 ring-1 ring-movipack/10 sm:px-10 sm:py-12 md:py-14">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-movipack/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex justify-center py-1">
          <BrandLogo
            variant="showcase"
            className="w-full max-w-[min(100%,420px)] drop-shadow-sm md:max-w-[min(100%,480px)] lg:max-w-[min(100%,520px)]"
          />
        </div>
      </div>

      <div className="flex w-full justify-center lg:justify-end">
        <HeroDeliveryVisual className="lg:max-w-lg" />
      </div>
    </div>
  );
}
