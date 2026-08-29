"use server";

import { leerAjustes } from "@/lib/ajustes";
import { armarVitrina } from "@/lib/precios";
import { combosActivos, ofertasActivas, mapaOfertas } from "@/lib/promos";
import { leerProductos } from "@/lib/productos";
import { getSesion } from "@/lib/sesion";

export async function preciosParaCarrito(ids: string[]) {
  const sesion = await getSesion();
  const [ajustes, productos, ofertas, combos] = await Promise.all([
    leerAjustes(),
    leerProductos(),
    ofertasActivas(),
    combosActivos(),
  ]);
  const porId = mapaOfertas(ofertas);
  const set = new Set(ids);
  const precios = productos
    .filter((p) => set.has(p.id))
    .map((p) => {
      const vitrina = armarVitrina(p, sesion, ajustes, porId.get(p.id));
      return {
        id: p.id,
        precio: vitrina.precioMostrar,
        precioLista: vitrina.precioLista,
        descuentoCliente: vitrina.descuentoCliente,
        tipoPromo: vitrina.tipoPromo,
      };
    });
  return { precios, combos };
}
