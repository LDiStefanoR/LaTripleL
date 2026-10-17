import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ADDRESS_FULL, HOURS_DETAIL } from "@/lib/brand";
import {
  MENSAJE_CATALOGO_PDF,
  MENSAJE_PEDIDO_GENERAL,
} from "@/lib/categorias";
import type { DatosLocal } from "@/lib/datos-local";
import { whatsappATelefono, whatsappPhoneDisplay, whatsappUrl } from "@/lib/whatsapp";

export function ContactSection({ datos }: { datos?: DatosLocal | null }) {
  const href =
    (datos?.telefono && whatsappATelefono(datos.telefono, MENSAJE_PEDIDO_GENERAL)) ||
    whatsappUrl(MENSAJE_PEDIDO_GENERAL);
  const telefono = datos?.telefono || whatsappPhoneDisplay();
  const direccion = datos?.direccion || ADDRESS_FULL;
  const horarios = datos?.horarios || HOURS_DETAIL;

  return (
    <section
      id="contacto"
      className="scroll-mt-24 border-t border-movipack/10 bg-[#fff6ea] py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-movipack/15 bg-white p-6 shadow-lg shadow-black/5 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-xl">
            <div className="mb-5 flex w-fit items-center gap-3 rounded-2xl border border-movipack/15 bg-movipack/5 px-4 py-3">
              <BrandLogo variant="inline" />
              <span className="text-xs font-bold uppercase tracking-wide text-movipack">
                Minimarket de barrio
              </span>
            </div>
            <h2 className="text-3xl font-extrabold text-[#111111] sm:text-4xl">
              Consultá stock y precios
            </h2>
            <p className="mt-3 text-lg text-neutral-600">
              WhatsApp directo: pedidos, consultas o el catálogo en PDF. También
              podés ver productos y precios en esta web.
            </p>
            <div className="mt-6 space-y-2 text-[#111111]">
              <p>
                <span className="font-bold">WhatsApp:</span>{" "}
                <a
                  href={href}
                  className="font-semibold text-emerald-700 underline-offset-4 hover:underline"
                >
                  {telefono}
                </a>
              </p>
              <p>
                <span className="font-bold">Dirección:</span> {direccion}
              </p>
              <p>
                <span className="font-bold">Horarios:</span> {horarios}
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-stretch gap-3 lg:mt-0 lg:min-w-[280px]">
            <WhatsAppButton href={href} size="xl" className="w-full">
              Escribinos ahora
            </WhatsAppButton>
            <a
              href={
                (datos?.telefono && whatsappATelefono(datos.telefono, MENSAJE_CATALOGO_PDF)) ||
                whatsappUrl(MENSAJE_CATALOGO_PDF)
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-movipack/30 px-4 text-sm font-bold text-movipack"
            >
              Pedir catálogo PDF
            </a>
            <Link
              href="/catalogo"
              className="inline-flex min-h-12 items-center justify-center text-sm font-semibold text-movipack-deep underline-offset-4 hover:underline"
            >
              Ver catálogo online
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
