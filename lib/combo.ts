import { formatoPesos, nombreVitrina } from "@/lib/format";
import { totalLineaConPromo } from "@/lib/oferta";
import type { ProductoVitrina } from "@/types/producto";
import type { ComboPromo, TipoOferta } from "@/types/promo";

export type LineaParaCombo = {
  id: string;
  nombre?: string;
  precio: number;
  cantidad: number;
  tipoPromo?: TipoOferta;
};

export type ComboVitrina = {
  id: string;
  productos: ProductoVitrina[];
  precioLista: number;
  precioPagar: number;
  precioCombo?: number;
};

export function avisoCombo(n: number, precioCombo?: number) {
  if (precioCombo && precioCombo > 0) {
    return `Llevá estos ${n} juntos por ${formatoPesos(precioCombo)}`;
  }
  if (n === 2) return "Llevá los 2: el más barato sale gratis";
  return "Llevá los 3: el más barato sale gratis";
}

export function precioPagarSet(precios: number[], precioCombo?: number) {
  const lista = precios.reduce((suma, n) => suma + n, 0);
  if (lista <= 0) return 0;
  if (precioCombo && precioCombo > 0) return Math.min(Math.round(precioCombo), lista);
  return lista - Math.min(...precios);
}

export function armarComboVitrina(
  combo: ComboPromo,
  porId: Map<string, ProductoVitrina>,
): ComboVitrina | null {
  const productos = combo.productoIds
    .map((id) => porId.get(id))
    .filter((p): p is ProductoVitrina => Boolean(p));
  if (productos.length < 2) return null;
  const precios = productos.map((p) => p.precioMostrar);
  const precioLista = precios.reduce((suma, n) => suma + n, 0);
  return {
    id: combo.id,
    productos,
    precioLista,
    precioPagar: precioPagarSet(precios, combo.precioCombo),
    precioCombo: combo.precioCombo,
  };
}

export function idsEnCombos(combos: ComboPromo[]) {
  return new Set(combos.flatMap((c) => c.productoIds));
}

type PagoLinea = Map<string, number>;

function aplicarUnCombo(
  combo: ComboPromo,
  leftover: Map<string, number>,
  precioDe: (id: string) => number,
  pago: PagoLinea,
) {
  const sets = Math.min(
    ...combo.productoIds.map((id) => leftover.get(id) ?? 0),
  );
  if (sets < 1) return 0;
  const precios = combo.productoIds.map((id) => precioDe(id));
  const lista = precios.reduce((suma, n) => suma + n, 0);
  const pagar = precioPagarSet(precios, combo.precioCombo);
  const ahorroSet = Math.max(0, lista - pagar);

  for (let i = 0; i < sets; i++) {
    if (combo.precioCombo && combo.precioCombo > 0 && lista > 0) {
      let asignado = 0;
      combo.productoIds.forEach((id, idx) => {
        const parte =
          idx === combo.productoIds.length - 1
            ? pagar - asignado
            : Math.round((precios[idx] / lista) * pagar);
        asignado += parte;
        pago.set(id, (pago.get(id) ?? 0) + parte);
      });
    } else {
      const min = Math.min(...precios);
      const barato = combo.productoIds.find(
        (_, idx) => precios[idx] === min,
      );
      for (const id of combo.productoIds) {
        pago.set(
          id,
          (pago.get(id) ?? 0) + (id === barato ? 0 : precioDe(id)),
        );
      }
    }
  }

  for (const id of combo.productoIds) {
    leftover.set(id, (leftover.get(id) ?? 0) - sets);
  }
  return ahorroSet * sets;
}

export function resumenCombosEnCarrito(
  lineas: LineaParaCombo[],
  combos: ComboPromo[],
) {
  const leftover = new Map(lineas.map((l) => [l.id, l.cantidad]));
  const pago = new Map<string, number>();
  const aplicadas: {
    id: string;
    sets: number;
    ahorro: number;
    nombres: string[];
  }[] = [];
  const precioDe = (id: string) =>
    lineas.find((l) => l.id === id)?.precio ?? 0;

  for (const combo of combos.filter((c) => c.activa)) {
    const antes = new Map(leftover);
    const ahorro = aplicarUnCombo(combo, leftover, precioDe, pago);
    const sets = Math.min(
      ...combo.productoIds.map((id) => (antes.get(id) ?? 0) - (leftover.get(id) ?? 0)),
    );
    if (sets < 1 || ahorro <= 0) continue;
    aplicadas.push({
      id: combo.id,
      sets,
      ahorro,
      nombres: combo.productoIds.map(
        (id) =>
          nombreVitrina(lineas.find((l) => l.id === id)?.nombre ?? ""),
      ),
    });
  }

  const porLinea = new Map<
    string,
    { neto: number; bruto: number; setsCombo: number }
  >();
  for (const linea of lineas) {
    const resto = leftover.get(linea.id) ?? 0;
    const deCombo = pago.get(linea.id) ?? 0;
    const setsCombo = linea.cantidad - resto;
    porLinea.set(linea.id, {
      bruto: linea.precio * linea.cantidad,
      neto:
        deCombo +
        totalLineaConPromo(resto, linea.precio, linea.tipoPromo),
      setsCombo,
    });
  }

  return { leftover, aplicadas, porLinea };
}

export function totalConCombos(lineas: LineaParaCombo[], combos: ComboPromo[]) {
  const { porLinea } = resumenCombosEnCarrito(lineas, combos);
  return lineas.reduce(
    (suma, linea) => suma + (porLinea.get(linea.id)?.neto ?? 0),
    0,
  );
}
