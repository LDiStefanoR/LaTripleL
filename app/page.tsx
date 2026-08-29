import { AboutSection } from "@/components/AboutSection";
import { CatalogPreview } from "@/components/CatalogPreview";
import { ClientsSection } from "@/components/ClientsSection";
import { ContactSection } from "@/components/ContactSection";
import { DeliverySection } from "@/components/DeliverySection";
import { FindUsSection } from "@/components/FindUsSection";
import { HeroSection } from "@/components/HeroSection";
import { PriceCompareSection } from "@/components/PriceCompareSection";
import { PromoCarousel } from "@/components/PromoCarousel";
import { leerAjustes } from "@/lib/ajustes";
import { armarVitrina } from "@/lib/precios";
import { leerProductos } from "@/lib/productos";
import { ofertasActivas, mapaOfertas } from "@/lib/promos";
import { leerRubros } from "@/lib/rubros";
import { getSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sesion = await getSesion();
  let productos: Awaited<ReturnType<typeof leerProductos>> = [];
  let rubros: Awaited<ReturnType<typeof leerRubros>> = [];
  let ajustes: Awaited<ReturnType<typeof leerAjustes>> | null = null;
  let ofertas: Awaited<ReturnType<typeof ofertasActivas>> = [];
  try {
    [ajustes, productos, ofertas] = await Promise.all([
      leerAjustes(),
      leerProductos(),
      ofertasActivas(),
    ]);
    rubros = await leerRubros(productos.map((p) => p.seccion));
  } catch (error) {
    console.error("[home] catálogo", error);
  }
  const ajustesOk = ajustes ?? {
    descuentoClienteGenerico: 10,
    ajustePorSeccion: {},
    descuentoClientePorSeccion: {},
  };
  const porOferta = mapaOfertas(ofertas);
  const vitrina = productos.map((p) =>
    armarVitrina(
      p,
      sesion?.rol === "admin" ? null : sesion,
      ajustesOk,
      porOferta.get(p.id),
    ),
  );
  const promos = vitrina.filter((p) => {
    const o = porOferta.get(p.id);
    return o ? o.carrusel : p.esPromo;
  });
  const comparativa = vitrina
    .filter((p) => (p.precioSuper ?? 0) > p.precioMostrar)
    .sort((a, b) => {
      const ahA = (a.precioSuper ?? 0) - a.precioMostrar;
      const ahB = (b.precioSuper ?? 0) - b.precioMostrar;
      return ahB - ahA;
    })
    .slice(0, 4);

  return (
    <main>
      <HeroSection />
      <PromoCarousel productos={promos} />
      <AboutSection />
      <PriceCompareSection productos={comparativa} />
      <ClientsSection />
      <DeliverySection />
      <CatalogPreview productos={productos} rubros={rubros} />
      <FindUsSection />
      <ContactSection />
    </main>
  );
}
