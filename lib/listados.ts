import { formatoPesos, nombreVitrina } from "@/lib/format";
import { diaArgentina, etiquetaFormaPago, fechaHoraVenta } from "@/lib/venta-texto";

export type TipoListado =
  | "stock-actual"
  | "stock-minimo"
  | "sin-stock"
  | "mas-vendidos"
  | "menos-vendidos"
  | "mejores-clientes"
  | "mas-deudas"
  | "morosidad"
  | "ventas"
  | "costo-ventas"
  | "ganancia"
  | "valor-stock"
  | "compras-proveedor"
  | "salidas-caja";

export type ProductoListado = {
  id: string;
  codigo: string;
  nombre: string;
  seccion: string;
  precio: number;
  stock: number | null;
  stockMinimo: number | null;
  costo: number | null;
};

export type VentaListado = {
  id: string;
  numero: number;
  creadoEn: string;
  empleado: string;
  cliente: string;
  formaPago: string;
  total: number;
  anulada?: boolean;
  lineas: { productoId: string; cantidad: number; precio: number }[];
};

export type DeudaListado = {
  nombre: string;
  telefono: string;
  debe: number;
  interes: number;
  semanas: number;
};

export type ComprobanteListado = {
  numero: string;
  fecha: string;
  proveedorNombre: string;
  origen: string;
  articulos: number;
  total: number;
};

export type RetiroListado = {
  creadoEn: string;
  empleado: string;
  concepto: string;
  monto: number;
};

export type FiltroListado = {
  desde?: string;
  hasta?: string;
  q?: string;
};

export type TablaListado = {
  titulo: string;
  columnas: string[];
  filas: string[][];
};

const TITULOS: Record<TipoListado, string> = {
  "stock-actual": "Stock actual",
  "stock-minimo": "Stock mínimo",
  "sin-stock": "Sin stock",
  "mas-vendidos": "Productos más vendidos",
  "menos-vendidos": "Productos menos vendidos",
  "mejores-clientes": "Mejores clientes",
  "mas-deudas": "Clientes con más deudas",
  morosidad: "Clientes con alta morosidad",
  ventas: "Ventas",
  "costo-ventas": "Costo de productos vendidos",
  ganancia: "Ganancia de ventas",
  "valor-stock": "Costo de mercadería en stock",
  "compras-proveedor": "Comprobantes de recepción",
  "salidas-caja": "Salidas de efectivo",
};

export function tituloListado(tipo: TipoListado) {
  return TITULOS[tipo];
}

export function esTipoListado(valor: string): valor is TipoListado {
  return valor in TITULOS;
}

function texto(valor: string) {
  return valor.trim().toLowerCase();
}

function enRango(iso: string, filtro: FiltroListado) {
  const dia = diaArgentina(new Date(iso));
  if (filtro.desde && dia < filtro.desde) return false;
  if (filtro.hasta && dia > filtro.hasta) return false;
  return true;
}

function coincide(q: string, partes: string[]) {
  const busqueda = texto(q);
  if (!busqueda) return true;
  return partes.some((parte) => texto(parte).includes(busqueda));
}

function unidadesVendidas(ventas: VentaListado[], filtro: FiltroListado) {
  const mapa = new Map<string, { unidades: number; importe: number }>();
  for (const venta of ventas) {
    if (venta.anulada || !enRango(venta.creadoEn, filtro)) continue;
    for (const linea of venta.lineas) {
      const actual = mapa.get(linea.productoId) ?? { unidades: 0, importe: 0 };
      actual.unidades += linea.cantidad;
      actual.importe += linea.precio * linea.cantidad;
      mapa.set(linea.productoId, actual);
    }
  }
  return mapa;
}

function filaProducto(
  producto: ProductoListado,
  etiqueta: Record<string, string>,
  extra: string[] = [],
) {
  return [
    producto.codigo,
    nombreVitrina(producto.nombre),
    etiqueta[producto.seccion] ?? producto.seccion,
    producto.stock == null ? "Sin control" : String(producto.stock),
    producto.stockMinimo == null ? "—" : String(producto.stockMinimo),
    producto.costo == null ? "—" : formatoPesos(producto.costo),
    formatoPesos(producto.precio),
    ...extra,
  ];
}

const COLUMNAS_PRODUCTO = ["Código", "Producto", "Sección", "Stock", "Mínimo", "Costo", "Precio"];

export function armarListado(
  tipo: TipoListado,
  datos: {
    productos: ProductoListado[];
    ventas: VentaListado[];
    deudas: DeudaListado[];
    etiqueta: Record<string, string>;
    comprobantes?: ComprobanteListado[];
    retiros?: RetiroListado[];
  },
  filtro: FiltroListado = {},
): TablaListado {
  const q = filtro.q ?? "";
  if (tipo === "valor-stock") {
    const lista = datos.productos.filter(
      (p) => typeof p.stock === "number" && p.stock !== 0 && coincide(q, [p.codigo, p.nombre]),
    );
    const filas = lista.map((p) => {
      const stock = p.stock ?? 0;
      const costo = p.costo == null ? null : p.costo * stock;
      return [
        p.codigo,
        nombreVitrina(p.nombre),
        String(stock),
        p.costo == null ? "Sin costo" : formatoPesos(p.costo),
        costo == null ? "—" : formatoPesos(costo),
        formatoPesos(p.precio),
        formatoPesos(p.precio * stock),
      ];
    });
    const costoTotal = lista.reduce((suma, p) => suma + (p.costo == null ? 0 : p.costo * (p.stock ?? 0)), 0);
    const ventaTotal = lista.reduce((suma, p) => suma + p.precio * (p.stock ?? 0), 0);
    if (filas.length > 0) filas.push(["", "Total", "", "", formatoPesos(costoTotal), "", formatoPesos(ventaTotal)]);
    return {
      titulo: TITULOS[tipo],
      columnas: ["Código", "Producto", "Stock", "Costo", "Costo en stock", "Precio", "Venta en stock"],
      filas,
    };
  }
  if (tipo === "compras-proveedor") {
    const lista = (datos.comprobantes ?? [])
      .filter((c) => {
        if (filtro.desde && c.fecha < filtro.desde) return false;
        if (filtro.hasta && c.fecha > filtro.hasta) return false;
        return coincide(q, [c.numero, c.proveedorNombre, c.origen]);
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero));
    const filas = lista.map((c) => [
      c.fecha.split("-").reverse().join("/"),
      c.numero,
      c.proveedorNombre,
      c.origen === "pedido" ? "Pedido" : "Sin pedido",
      String(c.articulos),
      formatoPesos(c.total),
    ]);
    if (filas.length > 0) {
      filas.push(["", "", "Total", "", "", formatoPesos(lista.reduce((suma, c) => suma + c.total, 0))]);
    }
    return {
      titulo: TITULOS[tipo],
      columnas: ["Fecha", "Factura", "Proveedor", "Origen", "Artículos", "Costo"],
      filas,
    };
  }
  if (tipo === "salidas-caja") {
    const lista = (datos.retiros ?? [])
      .filter((r) => enRango(r.creadoEn, filtro) && coincide(q, [r.concepto, r.empleado]))
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
    const filas = lista.map((r) => {
      const cuando = fechaHoraVenta(r.creadoEn);
      return [cuando.dia, cuando.hora, r.empleado, r.concepto, formatoPesos(r.monto)];
    });
    if (filas.length > 0) {
      filas.push(["", "", "Total", "", formatoPesos(lista.reduce((suma, r) => suma + r.monto, 0))]);
    }
    return {
      titulo: TITULOS[tipo],
      columnas: ["Día", "Hora", "Empleado", "Concepto", "Importe"],
      filas,
    };
  }
  const productos = datos.productos.filter((p) =>
    coincide(q, [p.codigo, p.nombre, datos.etiqueta[p.seccion] ?? p.seccion]),
  );

  if (tipo === "stock-actual" || tipo === "stock-minimo" || tipo === "sin-stock") {
    const lista = productos.filter((p) => {
      if (tipo === "stock-minimo") {
        return p.stock != null && p.stockMinimo != null && p.stock <= p.stockMinimo;
      }
      if (tipo === "sin-stock") return p.stock === 0;
      return true;
    });
    return {
      titulo: TITULOS[tipo],
      columnas: COLUMNAS_PRODUCTO,
      filas: lista.map((p) => filaProducto(p, datos.etiqueta)),
    };
  }

  if (tipo === "mas-vendidos" || tipo === "menos-vendidos") {
    const vendido = unidadesVendidas(datos.ventas, filtro);
    const lista = productos
      .map((p) => ({ producto: p, ...(vendido.get(p.id) ?? { unidades: 0, importe: 0 }) }))
      .filter((fila) => (tipo === "mas-vendidos" ? fila.unidades > 0 : true))
      .sort((a, b) =>
        tipo === "mas-vendidos" ? b.unidades - a.unidades : a.unidades - b.unidades,
      );
    return {
      titulo: TITULOS[tipo],
      columnas: [...COLUMNAS_PRODUCTO, "Unidades", "Importe"],
      filas: lista.map((fila) => [
        ...filaProducto(fila.producto, datos.etiqueta),
        String(fila.unidades),
        formatoPesos(fila.importe),
      ]),
    };
  }

  if (tipo === "costo-ventas" || tipo === "ganancia") {
    const vendido = unidadesVendidas(datos.ventas, filtro);
    const lista = productos
      .map((p) => {
        const venta = vendido.get(p.id) ?? { unidades: 0, importe: 0 };
        const costoTotal = p.costo == null ? null : p.costo * venta.unidades;
        const ganancia = costoTotal == null ? null : venta.importe - costoTotal;
        return { producto: p, ...venta, costoTotal, ganancia };
      })
      .filter((fila) => fila.unidades > 0)
      .sort((a, b) => b.importe - a.importe);
    if (tipo === "costo-ventas") {
      const filas = lista.map((fila) => [
        fila.producto.codigo,
        nombreVitrina(fila.producto.nombre),
        String(fila.unidades),
        fila.producto.costo == null ? "Sin costo" : formatoPesos(fila.producto.costo),
        fila.costoTotal == null ? "—" : formatoPesos(fila.costoTotal),
      ]);
      const total = lista.reduce((suma, fila) => suma + (fila.costoTotal ?? 0), 0);
      if (filas.length > 0) filas.push(["", "Total", "", "", formatoPesos(total)]);
      return {
        titulo: TITULOS[tipo],
        columnas: ["Código", "Producto", "Unidades", "Costo", "Costo total"],
        filas,
      };
    }
    const filas = lista.map((fila) => [
      fila.producto.codigo,
      nombreVitrina(fila.producto.nombre),
      String(fila.unidades),
      formatoPesos(fila.importe),
      fila.costoTotal == null ? "Sin costo" : formatoPesos(fila.costoTotal),
      fila.ganancia == null ? "—" : formatoPesos(fila.ganancia),
    ]);
    if (filas.length > 0) {
      filas.push([
        "",
        "Total",
        "",
        formatoPesos(lista.reduce((suma, fila) => suma + fila.importe, 0)),
        formatoPesos(lista.reduce((suma, fila) => suma + (fila.costoTotal ?? 0), 0)),
        formatoPesos(lista.reduce((suma, fila) => suma + (fila.ganancia ?? 0), 0)),
      ]);
    }
    return {
      titulo: TITULOS[tipo],
      columnas: ["Código", "Producto", "Unidades", "Venta", "Costo", "Ganancia"],
      filas,
    };
  }

  if (tipo === "mejores-clientes") {
    const mapa = new Map<string, { nombre: string; compras: number; total: number }>();
    for (const venta of datos.ventas) {
      if (venta.anulada || !enRango(venta.creadoEn, filtro)) continue;
      const nombre = venta.cliente.trim() || "Cliente genérico";
      if (!coincide(q, [nombre])) continue;
      const clave = nombre.toLowerCase();
      const actual = mapa.get(clave) ?? { nombre, compras: 0, total: 0 };
      actual.compras += 1;
      actual.total += venta.total;
      mapa.set(clave, actual);
    }
    const filas = [...mapa.values()].sort((a, b) => b.total - a.total);
    return {
      titulo: TITULOS[tipo],
      columnas: ["Cliente", "Compras", "Total"],
      filas: filas.map((fila) => [fila.nombre, String(fila.compras), formatoPesos(fila.total)]),
    };
  }

  if (tipo === "mas-deudas" || tipo === "morosidad") {
    const lista = datos.deudas
      .filter((d) => (tipo === "morosidad" ? d.semanas >= 1 || d.interes > 0 : d.debe > 0))
      .filter((d) => coincide(q, [d.nombre, d.telefono]))
      .sort((a, b) =>
        tipo === "morosidad" ? b.semanas - a.semanas || b.interes - a.interes : b.debe - a.debe,
      );
    return {
      titulo: TITULOS[tipo],
      columnas: ["Cliente", "Teléfono", "Deuda", "Interés", "Semanas de atraso"],
      filas: lista.map((d) => [
        d.nombre,
        d.telefono || "—",
        formatoPesos(d.debe),
        formatoPesos(d.interes),
        String(d.semanas),
      ]),
    };
  }

  const ventas = datos.ventas
    .filter((v) => enRango(v.creadoEn, filtro))
    .filter((v) => coincide(q, [v.cliente, v.empleado, String(v.numero), v.formaPago]))
    .sort((a, b) => b.numero - a.numero);
  return {
    titulo: TITULOS.ventas,
    columnas: ["Factura", "Día", "Hora", "Empleado", "Cliente", "Pago", "Importe"],
    filas: ventas.map((v) => {
      const cuando = fechaHoraVenta(v.creadoEn);
      return [
        `${v.numero}${v.anulada ? " anulada" : ""}`,
        cuando.dia,
        cuando.hora,
        v.empleado,
        v.cliente,
        etiquetaFormaPago(v.formaPago),
        formatoPesos(v.total),
      ];
    }),
  };
}
