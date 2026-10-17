import { BrandLogo } from "@/components/BrandLogo";
import { ADDRESS_FULL, HOURS_SHORT } from "@/lib/brand";
import { MENSAJE_PEDIDO_GENERAL } from "@/lib/categorias";
import type { DatosLocal } from "@/lib/datos-local";
import { whatsappATelefono, whatsappPhoneDisplay, whatsappUrl } from "@/lib/whatsapp";

export function SiteFooter({ datos }: { datos?: DatosLocal | null }) {
  const direccion = datos?.direccion || ADDRESS_FULL;
  const horarios = datos?.horarios || HOURS_SHORT;
  const telefono = datos?.telefono || whatsappPhoneDisplay();
  const wa = (datos?.telefono && whatsappATelefono(datos.telefono, MENSAJE_PEDIDO_GENERAL)) || whatsappUrl(MENSAJE_PEDIDO_GENERAL);

  return (
    <footer className="border-t border-white/10 bg-[#0a0a0a] text-neutral-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="w-fit rounded-2xl bg-black p-3 shadow-lg shadow-black/20 ring-1 ring-white/20">
            <BrandLogo variant="footer" />
          </div>
          <div>
            <p className="text-sm text-neutral-400">Minimarket · Rosario</p>
            <p className="text-sm text-neutral-400">{direccion}</p>
          </div>
        </div>
        <div className="text-sm">
          <a
            href={wa}
            className="font-semibold text-emerald-400 hover:underline"
          >
            {telefono}
          </a>
          <p className="mt-1 text-neutral-400">{horarios}</p>
        </div>
      </div>
    </footer>
  );
}
