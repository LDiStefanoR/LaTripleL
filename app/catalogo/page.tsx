import type { Metadata } from "next";
import { ProductCatalog } from "@/components/ProductCatalog";
import { AJUSTES_PRECIOS_BASE, leerAjustes } from "@/lib/ajustes";
import { BRAND_NAME } from "@/lib/brand";
import { armarComboVitrina, idsEnCombos } from "@/lib/combo";
import { armarVitrina, modoPrecio } from "@/lib/precios";
import { getSesion } from "@/lib/sesion";
import { leerProductos } from "@/lib/productos";
import { combosActivos, ofertasActivas, mapaOfertas } from "@/lib/promos";
import { leerRubros } from "@/lib/rubros";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Catálogo | ${BRAND_NAME}`,
  description:
    "Catálogo de La Triple L Minimarket: almacén, bebidas, limpieza, galletitas y más. Precios de lista y pedido por WhatsApp.",
};

type Props = {
  searchParams: Promise<{ seccion?: string | string[] }>;
};

export default async function CatalogoPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = params.seccion;
  const seccion = Array.isArray(raw) ? raw[0] : raw;
  const sesion = await getSesion();
  let ajustes: Awaited<ReturnType<typeof leerAjustes>> | null = null;
  let productos: Awaited<ReturnType<typeof leerProductos>> = [];
  let rubros: Awaited<ReturnType<typeof leerRubros>> = [];
  try {
    [ajustes, productos] = await Promise.all([leerAjustes(), leerProductos()]);
    rubros = await leerRubros(productos.map((p) => p.seccion));
  } catch (error) {
    console.error("[catalogo]", error);
  }
  const ofertas = await ofertasActivas().catch(() => []);
  const combos = await combosActivos().catch(() => []);
  const porOferta = mapaOfertas(ofertas);
  const enCombo = idsEnCombos(combos);
  const ajustesOk = ajustes ?? AJUSTES_PRECIOS_BASE;
  const vitrina = productos.map((p) => ({
    ...armarVitrina(p, sesion, ajustesOk, porOferta.get(p.id)),
    enCombo: enCombo.has(p.id),
  }));
  const porVitrina = new Map(vitrina.map((p) => [p.id, p]));
  const combosVista = combos
    .map((c) => armarComboVitrina(c, porVitrina))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const modo = modoPrecio(sesion);
  const aviso =
    modo === "cliente"
      ? "Estás viendo tu precio de cliente registrado, en rojo. Al lado, en gris y tachado, está el precio de lista."
      : modo === "admin"
        ? "Como admin ves el precio de lista y el descuento del catálogo para los clientes registrados."
        : "Estos son los precios de lista. Con una cuenta en la página ves tu precio, más bajo, en rojo.";

  return (
    <main>
      <ProductCatalog
        productos={vitrina}
        rubros={rubros}
        seccionInicial={seccion}
        aviso={aviso}
        combos={combosVista}
      />
    </main>
  );
}
