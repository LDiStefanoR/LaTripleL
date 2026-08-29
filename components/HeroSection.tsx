import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import {
  ADDRESS_LINE,
  BRAND_NAME,
  HOURS_SHORT,
} from "@/lib/brand";
import { MENSAJE_PEDIDO_GENERAL } from "@/lib/categorias";
import { whatsappPhoneDisplay, whatsappUrl } from "@/lib/whatsapp";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow absolute inset-0" />
      <Confetti />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-20">
        <div className="space-y-6 text-white">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">
            Minimarket online · Rosario
          </p>
          <h1 className="font-display text-4xl font-bold italic leading-tight tracking-tight sm:text-5xl lg:text-[3.4rem]">
            El súper del barrio,
            <span className="block not-italic text-white">
              ahora en tu celular
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-white/90 sm:text-xl">
            Somos {BRAND_NAME}, un minimarket de Rosario. Armás el pedido en
            esta plataforma, lo confirmamos y te lo llevamos a todo Rosario —
            o lo pasás a buscar en {ADDRESS_LINE}.
          </p>
          <p className="text-base text-white/80">
            Precios de minimarket, no de góndola de cadena. Mirá las promos,
            compará y pedí en minutos.
          </p>

          <div className="grid gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-confetti">
                WhatsApp
              </p>
              <a
                href={whatsappUrl(MENSAJE_PEDIDO_GENERAL)}
                className="mt-1 block text-lg font-bold underline-offset-4 hover:underline"
              >
                {whatsappPhoneDisplay()}
              </a>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-confetti">
                Envío y local
              </p>
              <p className="mt-1 text-sm font-semibold">Todo Rosario</p>
              <p className="text-sm font-semibold">{HOURS_SHORT}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/catalogo"
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-confetti px-6 text-base font-bold text-neutral-900 shadow-lg shadow-black/20 transition hover:brightness-110"
            >
              Pedir en la plataforma
            </Link>
            <WhatsAppButton
              href={whatsappUrl(MENSAJE_PEDIDO_GENERAL)}
              size="xl"
              className="w-full sm:w-auto"
            >
              Pedir por WhatsApp
            </WhatsAppButton>
            <Link
              href="/promos"
              className="inline-flex min-h-14 items-center justify-center px-2 text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
            >
              Ver promociones
            </Link>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-md justify-center lg:max-w-none">
          <div className="relative rounded-[2rem] border border-white/20 bg-black/40 p-4 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-6">
            <BrandLogo variant="showcase" className="drop-shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Confetti() {
  const dots = [
    { top: "12%", left: "8%", size: 10, color: "#FFBA08" },
    { top: "22%", left: "46%", size: 8, color: "#E85D04" },
    { top: "18%", left: "72%", size: 12, color: "#DC2F02" },
    { top: "68%", left: "6%", size: 9, color: "#FFBA08" },
    { top: "78%", left: "38%", size: 11, color: "#E85D04" },
    { top: "70%", left: "92%", size: 8, color: "#DC2F02" },
    { top: "40%", left: "96%", size: 7, color: "#FFBA08" },
    { top: "8%", left: "90%", size: 9, color: "#E85D04" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {dots.map((d, i) => (
        <span
          key={i}
          className="confetti-dot"
          style={{
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            background: d.color,
          }}
        />
      ))}
    </div>
  );
}
