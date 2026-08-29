import { BrandLogo } from "@/components/BrandLogo";
import { ADDRESS_LINE, HOURS_SHORT } from "@/lib/brand";
import { MENSAJE_PEDIDO_GENERAL } from "@/lib/categorias";
import { whatsappPhoneDisplay, whatsappUrl } from "@/lib/whatsapp";

export function SiteFooter() {
  const wa = whatsappUrl(MENSAJE_PEDIDO_GENERAL);

  return (
    <footer className="border-t border-white/10 bg-[#0a0a0a] text-neutral-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="w-fit rounded-2xl bg-black p-3 shadow-lg shadow-black/20 ring-1 ring-white/20">
            <BrandLogo variant="footer" />
          </div>
          <div>
            <p className="text-sm text-neutral-400">Minimarket · Rosario</p>
            <p className="text-sm text-neutral-400">{ADDRESS_LINE}</p>
          </div>
        </div>
        <div className="text-sm">
          <a
            href={wa}
            className="font-semibold text-emerald-400 hover:underline"
          >
            {whatsappPhoneDisplay()}
          </a>
          <p className="mt-1 text-neutral-400">{HOURS_SHORT}</p>
        </div>
      </div>
    </footer>
  );
}
