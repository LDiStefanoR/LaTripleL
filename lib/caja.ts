import { randomUUID } from "crypto";
import { ID_LINEA_ENVIO } from "@/lib/carrito";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { guardarProductos, leerProductos } from "@/lib/productos";

export type LineaVentaCaja = {
  productoId: string;
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: number;
  descontoStock: boolean;
};

export type LineaDevolucionCaja = {
  productoId: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio: number;
};

export type DevolucionCaja = {
  id: string;
  creadoEn: string;
  empleado: string;
  reponerStock: boolean;
  lineas: LineaDevolucionCaja[];
  total: number;
};

export type VentaCaja = {
  id: string;
  numero: number;
  creadoEn: string;
  empleado: string;
  empleadoEmail: string;
  cliente: string;
  clienteId?: string;
  formaPago: string;
  lineas: LineaVentaCaja[];
  total: number;
  anulada?: boolean;
  devoluciones?: DevolucionCaja[];
};

export function hoyArgentina(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(fecha);
}

export async function leerVentasCaja(): Promise<VentaCaja[]> {
  const parsed = await leerJsonData<VentaCaja[]>("ventas-caja.json", []);
  return Array.isArray(parsed) ? parsed : [];
}

async function guardarVentas(ventas: VentaCaja[]) {
  await escribirJsonData("ventas-caja.json", ventas);
}

export async function ventasDelDia(dia = hoyArgentina()) {
  const ventas = await leerVentasCaja();
  return ventas
    .filter((v) => hoyArgentina(new Date(v.creadoEn)) === dia)
    .sort((a, b) => b.numero - a.numero);
}

export async function ultimoNumeroVenta() {
  const ventas = await leerVentasCaja();
  return ventas.reduce((max, v) => Math.max(max, v.numero || 0), 0);
}

export async function ventasDeCliente(datos: { clienteId: string; nombre: string }) {
  const nombre = datos.nombre.trim().toLowerCase();
  const ventas = await leerVentasCaja();
  return ventas
    .filter((v) => {
      if (v.anulada) return false;
      if (v.clienteId) return v.clienteId === datos.clienteId;
      return nombre.length > 2 && v.cliente.trim().toLowerCase() === nombre;
    })
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export async function buscarVentaCaja(id: string) {
  const ventas = await leerVentasCaja();
  return ventas.find((v) => v.id === id) ?? null;
}

export async function descontarStock(
  movimientos: { productoId: string; cantidad: number }[],
) {
  if (movimientos.length === 0) return;
  const productos = await leerProductos();
  let cambio = false;
  for (const mov of movimientos) {
    if (mov.cantidad < 1) continue;
    const producto = productos.find((p) => p.id === mov.productoId);
    if (!producto || typeof producto.stock !== "number") continue;
    producto.stock = Math.max(0, producto.stock - mov.cantidad);
    cambio = true;
  }
  if (cambio) await guardarProductos(productos);
}

export async function registrarVentaCaja(datos: {
  empleado: string;
  empleadoEmail: string;
  cliente: string;
  clienteId?: string;
  formaPago?: string;
  lineas: { productoId: string; cantidad: number; precio: number }[];
}) {
  if (datos.lineas.length === 0) {
    return { error: "La venta está vacía." as const };
  }
  const productos = await leerProductos();
  const armadas: LineaVentaCaja[] = [];
  for (const linea of datos.lineas) {
    if (!Number.isFinite(linea.cantidad) || linea.cantidad < 1) {
      return { error: "La cantidad tiene que ser al menos 1." as const };
    }
    if (linea.productoId === ID_LINEA_ENVIO) {
      armadas.push({
        productoId: ID_LINEA_ENVIO,
        codigo: "ENVIO",
        nombre: "Envío a domicilio",
        precio: Math.max(0, Math.round(linea.precio)),
        cantidad: 1,
        descontoStock: false,
      });
      continue;
    }
    const producto = productos.find((p) => p.id === linea.productoId);
    if (!producto) return { error: "Hay un producto que ya no está en el catálogo." as const };
    const cantidad = Math.round(linea.cantidad);
    if (typeof producto.stock === "number" && producto.stock < cantidad) {
      return {
        error: `No hay stock de ${producto.nombre}. Quedan ${producto.stock}.` as const,
      };
    }
    armadas.push({
      productoId: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      precio: Math.round(linea.precio),
      cantidad,
      descontoStock: typeof producto.stock === "number",
    });
  }

  for (const linea of armadas) {
    if (!linea.descontoStock) continue;
    const producto = productos.find((p) => p.id === linea.productoId);
    if (producto && typeof producto.stock === "number") {
      producto.stock -= linea.cantidad;
    }
  }
  await guardarProductos(productos);

  const ventas = await leerVentasCaja();
  const numero = ventas.reduce((max, v) => Math.max(max, v.numero || 0), 0) + 1;
  const venta: VentaCaja = {
    id: randomUUID(),
    numero,
    creadoEn: new Date().toISOString(),
    empleado: datos.empleado,
    empleadoEmail: datos.empleadoEmail,
    cliente: datos.cliente.trim() || "Cliente genérico",
    clienteId: datos.clienteId || undefined,
    formaPago: datos.formaPago ?? "contado",
    lineas: armadas,
    total: armadas.reduce((suma, l) => suma + l.precio * l.cantidad, 0),
  };
  ventas.push(venta);
  await guardarVentas(ventas);
  return { venta };
}

export async function anularVentaCaja(id: string) {
  const ventas = await leerVentasCaja();
  const venta = ventas.find((v) => v.id === id);
  if (!venta) return { error: "No encontramos esa venta." as const };
  if (venta.anulada) return { error: "Esa venta ya está anulada." as const };
  if (hoyArgentina(new Date(venta.creadoEn)) !== hoyArgentina()) {
    return { error: "Solo se puede anular una venta del día." as const };
  }
  const productos = await leerProductos();
  for (const linea of venta.lineas) {
    if (!linea.descontoStock) continue;
    const producto = productos.find((p) => p.id === linea.productoId);
    if (producto && typeof producto.stock === "number") {
      producto.stock += linea.cantidad;
    }
  }
  await guardarProductos(productos);
  venta.anulada = true;
  await guardarVentas(ventas);
  return { ok: true as const, numero: venta.numero };
}

/** Cantidad ya devuelta por producto en una venta. */
export function cantidadDevuelta(venta: VentaCaja, productoId: string) {
  return (venta.devoluciones ?? []).reduce((suma, d) => {
    for (const linea of d.lineas) {
      if (linea.productoId === productoId) suma += linea.cantidad;
    }
    return suma;
  }, 0);
}

export async function devolverVentaCaja(datos: {
  ventaId: string;
  empleado: string;
  reponerStock: boolean;
  items: { productoId: string; cantidad: number }[];
}) {
  const ventas = await leerVentasCaja();
  const venta = ventas.find((v) => v.id === datos.ventaId);
  if (!venta) return { error: "No encontramos ese comprobante." as const };
  if (venta.anulada) return { error: "Esa venta está anulada." as const };
  if (datos.items.length === 0) {
    return { error: "Elegí al menos un producto para devolver." as const };
  }

  const lineasDev: LineaDevolucionCaja[] = [];
  for (const item of datos.items) {
    const cantidad = Math.round(item.cantidad);
    if (!Number.isFinite(cantidad) || cantidad < 1) {
      return { error: "La cantidad a devolver no es válida." as const };
    }
    const original = venta.lineas.find((l) => l.productoId === item.productoId);
    if (!original) return { error: "Hay un producto que no está en ese comprobante." as const };
    const ya = cantidadDevuelta(venta, item.productoId);
    const disponible = original.cantidad - ya;
    if (cantidad > disponible) {
      return {
        error: `De ${original.nombre} solo se pueden devolver ${disponible}.` as const,
      };
    }
    lineasDev.push({
      productoId: original.productoId,
      codigo: original.codigo,
      nombre: original.nombre,
      cantidad,
      precio: original.precio,
    });
  }

  if (datos.reponerStock) {
    const productos = await leerProductos();
    let cambio = false;
    for (const linea of lineasDev) {
      const original = venta.lineas.find((l) => l.productoId === linea.productoId);
      if (!original?.descontoStock) continue;
      const producto = productos.find((p) => p.id === linea.productoId);
      if (producto && typeof producto.stock === "number") {
        producto.stock += linea.cantidad;
        cambio = true;
      }
    }
    if (cambio) await guardarProductos(productos);
  }

  const devolucion: DevolucionCaja = {
    id: randomUUID(),
    creadoEn: new Date().toISOString(),
    empleado: datos.empleado,
    reponerStock: datos.reponerStock,
    lineas: lineasDev,
    total: lineasDev.reduce((s, l) => s + l.precio * l.cantidad, 0),
  };
  venta.devoluciones = [...(venta.devoluciones ?? []), devolucion];

  const todoDevuelto = venta.lineas.every(
    (l) => cantidadDevuelta(venta, l.productoId) >= l.cantidad,
  );
  if (todoDevuelto) venta.anulada = true;

  await guardarVentas(ventas);
  return {
    ok: true as const,
    numero: venta.numero,
    total: devolucion.total,
    reponerStock: datos.reponerStock,
    completa: todoDevuelto,
  };
}

export async function guardarStockProducto(
  productoId: string,
  stock: number,
  mostrarEnCaja = true,
) {
  if (!Number.isFinite(stock) || stock < 0) {
    return { error: "El stock no puede ser negativo." as const };
  }
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." as const };
  producto.stock = Math.round(stock);
  producto.mostrarEnCaja = mostrarEnCaja;
  await guardarProductos(productos);
  return { ok: true as const, nombre: producto.nombre, stock: producto.stock };
}
