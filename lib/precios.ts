import type { AjustesPrecios } from "@/types/ajustes";
import type { SesionPublica } from "@/types/auth";
import type { ModoPrecio, Producto, ProductoVitrina } from "@/types/producto";
import type { Oferta } from "@/types/promo";
import { formatoPesos } from "@/lib/format";

export function precioLista(producto: Producto, ajustes: AjustesPrecios) {
  const extra = ajustes.ajustePorSeccion[producto.seccion] ?? 0;
  return Math.round(producto.precio * (1 + extra / 100));
}

export function descuentoClienteDe(
  _seccion: string,
  ajustes: AjustesPrecios,
) {
  return ajustes.descuentoClienteGenerico;
}

export function precioConDescuentoCliente(lista: number, descuento: number) {
  return Math.round(lista * (1 - descuento / 100));
}

export function modoPrecio(sesion: SesionPublica | null): ModoPrecio {
  if (sesion?.rol === "admin") return "admin";
  if (sesion?.rol === "cliente") return "cliente";
  return "publico";
}

export function precioPromoDe(
  producto: Producto,
  lista: number,
  oferta?: Oferta | null,
) {
  if (oferta?.tipo === "precio" && oferta.precioPromo && oferta.precioPromo > 0) {
    return Math.round(oferta.precioPromo);
  }
  if (oferta && oferta.tipo !== "precio") return null;
  if (!producto.promoActiva) return null;
  const promo = Math.round(Number(producto.precioPromo) || 0);
  if (promo < 1) return lista;
  return promo;
}

export function armarVitrina(
  producto: Producto,
  sesion: SesionPublica | null,
  ajustes: AjustesPrecios,
  oferta?: Oferta | null,
): ProductoVitrina {
  const lista = precioLista(producto, ajustes);
  const especial = sesion?.rol === "cliente" ? Math.min(100, Math.max(0, Math.round(sesion.descuento ?? 0))) : 0;
  const descuento = especial > 0 ? especial : descuentoClienteDe(producto.seccion, ajustes);
  const cliente = precioConDescuentoCliente(lista, descuento);
  const promo = precioPromoDe(producto, lista, oferta);
  const esPromo = Boolean(oferta?.activa) || Boolean(producto.promoActiva);
  const tipoPromo = oferta?.tipo;
  const modo = modoPrecio(sesion);

  const aplicaPrecio = tipoPromo === "precio" || (!oferta && promo != null);
  const mejorPublico = aplicaPrecio && promo != null ? Math.min(promo, lista) : lista;
  const mejorCliente =
    aplicaPrecio && promo != null ? Math.min(promo, cliente) : cliente;

  if (modo === "cliente") {
    return {
      ...producto,
      precio: mejorCliente,
      precioLista: lista,
      precioMostrar: mejorCliente,
      descuentoCliente: descuento,
      esPromo,
      tipoPromo,
    };
  }

  if (modo === "admin") {
    const extra = esPromo
      ? tipoPromo === "2x1" || tipoPromo === "3x2"
        ? ` · Promo ${tipoPromo}`
        : ` · Promo ${formatoPesos(mejorPublico)}`
      : "";
    return {
      ...producto,
      precio: lista,
      precioLista: lista,
      precioMostrar: lista,
      descuentoCliente: descuento,
      esPromo,
      tipoPromo,
      notaAdmin: `Dto. clientes registrados: ${descuento}% → ${formatoPesos(cliente)}${extra}`,
    };
  }

  return {
    ...producto,
    precio: mejorPublico,
    precioLista: lista,
    precioMostrar: mejorPublico,
    descuentoCliente: descuento,
    esPromo,
    tipoPromo,
  };
}
