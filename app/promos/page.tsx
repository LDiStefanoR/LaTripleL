import type { Metadata } from "next";
import { PromosVista } from "@/components/PromosVista";
import { BRAND_NAME } from "@/lib/brand";
import { leerAjustes } from "@/lib/ajustes";
import { armarComboVitrina, idsEnCombos } from "@/lib/combo";
import { armarVitrina } from "@/lib/precios";
import { leerProductos } from "@/lib/productos";
import { leerPromos, mapaOfertas } from "@/lib/promos";
import { getSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Promos | ${BRAND_NAME}`,
  description:
    "Promociones 2x1, 3x2 y afiches de La Triple L Minimarket en Rosario.",
};

export default async function PromosPage() {
  const sesion = await getSesion();
  const [ajustes, productos, promos] = await Promise.all([
    leerAjustes(),
    leerProductos(),
    leerPromos(),
  ]);
  const porId = mapaOfertas(promos.ofertas);
  const enCombo = idsEnCombos(promos.combos ?? []);
  const destacadas = productos
    .map((p) => ({
      ...armarVitrina(p, sesion, ajustes, porId.get(p.id)),
      enCombo: enCombo.has(p.id),
    }))
    .filter((p) => p.esPromo)
    .sort((a, b) => {
      const rank = (t?: string) => (t === "2x1" || t === "3x2" ? 0 : 1);
      return rank(a.tipoPromo) - rank(b.tipoPromo);
    });
  const porVitrina = new Map(
    productos.map((p) => [
      p.id,
      { ...armarVitrina(p, sesion, ajustes, porId.get(p.id)), enCombo: enCombo.has(p.id) },
    ]),
  );
  const combos = (promos.combos ?? [])
    .filter((c) => c.activa)
    .map((c) => armarComboVitrina(c, porVitrina))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <main className="flex-1 bg-[#fff6ea]">
      <PromosVista
        destacadas={destacadas}
        combos={combos}
        afiches={promos.afiches}
        esAdmin={sesion?.rol === "admin"}
      />
    </main>
  );
}
