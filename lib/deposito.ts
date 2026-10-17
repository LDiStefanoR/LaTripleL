import { randomUUID } from "crypto";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { leerAjustes } from "@/lib/ajustes";
import { guardarStockProducto } from "@/lib/caja";
import { leerMargen, leerEnteroOpcional } from "@/lib/margen";
import { guardarProductos, leerProductos } from "@/lib/productos";

export type Proveedor = {
  id: string;
  nombre: string;
  telefono: string;
  nota: string;
};

export type LineaPedidoProveedor = {
  productoId: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  costo?: number;
  /** Unidades que ya entraron al stock. */
  recibido?: number;
};

export type PedidoProveedor = {
  id: string;
  numero: number;
  proveedorId: string;
  proveedorNombre: string;
  lineas: LineaPedidoProveedor[];
  estado: "pedido" | "parcial" | "recibido";
  creadoEn: string;
  recibidoEn?: string;
  /** Última factura con la que se recepcionó mercadería. */
  factura?: string;
};

export type RegularizacionStock = {
  id: string;
  productoId: string;
  codigo: string;
  nombre: string;
  anterior: number | null;
  nuevo: number;
  empleado: string;
  creadoEn: string;
};

export async function leerProveedores(): Promise<Proveedor[]> {
  const lista = await leerJsonData<Proveedor[]>("proveedores.json", []);
  return Array.isArray(lista) ? lista : [];
}

export async function guardarProveedor(datos: {
  nombre: string;
  telefono: string;
  nota: string;
}) {
  const nombre = datos.nombre.trim();
  if (nombre.length < 2) return { error: "Ingresá el nombre del proveedor." as const };
  const lista = await leerProveedores();
  if (lista.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) {
    return { error: "Ya hay un proveedor con ese nombre." as const };
  }
  const proveedor: Proveedor = {
    id: randomUUID(),
    nombre,
    telefono: datos.telefono.trim(),
    nota: datos.nota.trim(),
  };
  lista.unshift(proveedor);
  await escribirJsonData("proveedores.json", lista);
  return { ok: true as const, proveedor };
}

export async function quitarProveedor(id: string) {
  const lista = await leerProveedores();
  const proveedor = lista.find((p) => p.id === id);
  if (!proveedor) return { error: "No encontramos ese proveedor." as const };
  await escribirJsonData(
    "proveedores.json",
    lista.filter((p) => p.id !== id),
  );
  return { ok: true as const, nombre: proveedor.nombre };
}

export async function leerPedidosProveedor(): Promise<PedidoProveedor[]> {
  const lista = await leerJsonData<PedidoProveedor[]>("pedidos-proveedor.json", []);
  return Array.isArray(lista) ? lista : [];
}

export async function crearPedidoProveedor(datos: {
  proveedorId: string;
  lineas: { productoId: string; cantidad: number }[];
}) {
  const proveedores = await leerProveedores();
  const proveedor = proveedores.find((p) => p.id === datos.proveedorId);
  if (!proveedor) return { error: "Elegí un proveedor." as const };
  const productos = await leerProductos();
  const lineas: LineaPedidoProveedor[] = [];
  for (const linea of datos.lineas) {
    const cantidad = Math.round(Number(linea.cantidad));
    if (!Number.isFinite(cantidad) || cantidad < 1) continue;
    const producto = productos.find((p) => p.id === linea.productoId);
    if (!producto) return { error: "Hay un producto que ya no está en el catálogo." as const };
    const previa = lineas.find((l) => l.productoId === producto.id);
    if (previa) previa.cantidad += cantidad;
    else {
      lineas.push({
        productoId: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad,
        ...(typeof producto.costo === "number" ? { costo: producto.costo } : {}),
      });
    }
  }
  if (lineas.length === 0) {
    return { error: "Agregá al menos un producto al pedido." as const };
  }
  const pedidos = await leerPedidosProveedor();
  const numero = pedidos.reduce((max, p) => Math.max(max, p.numero), 0) + 1;
  const pedido: PedidoProveedor = {
    id: randomUUID(),
    numero,
    proveedorId: proveedor.id,
    proveedorNombre: proveedor.nombre,
    lineas,
    estado: "pedido",
    creadoEn: new Date().toISOString(),
  };
  pedidos.unshift(pedido);
  await escribirJsonData("pedidos-proveedor.json", pedidos);
  return { ok: true as const, pedido };
}

export async function actualizarPedidoProveedor(datos: {
  id: string;
  proveedorId: string;
  lineas: { productoId: string; cantidad: number }[];
}) {
  const pedidos = await leerPedidosProveedor();
  const pedido = pedidos.find((p) => p.id === datos.id);
  if (!pedido) return { error: "No encontramos ese pedido." as const };
  if (pedido.estado === "recibido") {
    return { error: "Ese pedido ya se recibió. No se puede modificar." as const };
  }
  const proveedores = await leerProveedores();
  const proveedor = proveedores.find((p) => p.id === datos.proveedorId);
  if (!proveedor) return { error: "Elegí un proveedor." as const };
  const productos = await leerProductos();
  const nuevas: LineaPedidoProveedor[] = [];
  for (const linea of datos.lineas) {
    const cantidad = Math.round(Number(linea.cantidad));
    if (!Number.isFinite(cantidad) || cantidad < 1) continue;
    const producto = productos.find((p) => p.id === linea.productoId);
    if (!producto) return { error: "Hay un producto que ya no está en el catálogo." as const };
    const previa = nuevas.find((l) => l.productoId === producto.id);
    if (previa) previa.cantidad += cantidad;
    else {
      const anterior = pedido.lineas.find((l) => l.productoId === producto.id);
      const recibido = anterior ? recibidoDeLinea(anterior, pedido.estado) : 0;
      nuevas.push({
        productoId: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad,
        ...(typeof producto.costo === "number" ? { costo: producto.costo } : {}),
        ...(recibido > 0 ? { recibido } : {}),
      });
    }
  }
  for (const anterior of pedido.lineas) {
    const recibido = recibidoDeLinea(anterior, pedido.estado);
    if (recibido < 1) continue;
    const nueva = nuevas.find((l) => l.productoId === anterior.productoId);
    if (!nueva || nueva.cantidad < recibido) {
      return {
        error: `${anterior.nombre} ya tiene ${recibido} unidades recibidas. No podés pedir menos.` as const,
      };
    }
  }
  if (nuevas.length === 0) return { error: "Agregá al menos un producto al pedido." as const };
  pedido.proveedorId = proveedor.id;
  pedido.proveedorNombre = proveedor.nombre;
  pedido.lineas = nuevas;
  const completo = nuevas.every((l) => (l.recibido ?? 0) >= l.cantidad);
  const alguno = nuevas.some((l) => (l.recibido ?? 0) > 0);
  pedido.estado = completo ? "recibido" : alguno ? "parcial" : "pedido";
  if (completo) pedido.recibidoEn = new Date().toISOString();
  await escribirJsonData("pedidos-proveedor.json", pedidos);
  return { ok: true as const, numero: pedido.numero };
}

export async function recibirPedidoProveedor(id: string) {
  const pedidos = await leerPedidosProveedor();
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) return { error: "No encontramos ese pedido." as const };
  if (pedido.estado === "recibido") {
    return { error: "Ese pedido ya se recibió." as const };
  }
  const productos = await leerProductos();
  for (const linea of pedido.lineas) {
    const producto = productos.find((p) => p.id === linea.productoId);
    if (!producto) continue;
    const actual = typeof producto.stock === "number" ? producto.stock : 0;
    const ya = recibidoDeLinea(linea, pedido.estado);
    producto.stock = actual + Math.max(0, linea.cantidad - ya);
    linea.recibido = linea.cantidad;
  }
  await guardarProductos(productos);
  pedido.estado = "recibido";
  pedido.recibidoEn = new Date().toISOString();
  await escribirJsonData("pedidos-proveedor.json", pedidos);
  return { ok: true as const, numero: pedido.numero };
}

export function recibidoDeLinea(
  linea: LineaPedidoProveedor,
  estado: PedidoProveedor["estado"],
) {
  if (typeof linea.recibido === "number") return Math.max(0, Math.round(linea.recibido));
  return estado === "recibido" ? linea.cantidad : 0;
}

export type LineaComprobanteCompra = {
  productoId: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  costo: number;
};

export type ComprobanteCompra = {
  id: string;
  numero: string;
  fecha: string;
  proveedorId: string;
  proveedorNombre: string;
  pedidoId?: string;
  pedidoNumero?: number;
  origen: "pedido" | "directa";
  lineas: LineaComprobanteCompra[];
  total: number;
  empleado: string;
  creadoEn: string;
};

export async function leerComprobantesCompra(): Promise<ComprobanteCompra[]> {
  const lista = await leerJsonData<ComprobanteCompra[]>("comprobantes-compra.json", []);
  return Array.isArray(lista) ? lista : [];
}

async function guardarComprobante(comprobante: ComprobanteCompra) {
  const lista = await leerComprobantesCompra();
  lista.unshift(comprobante);
  await escribirJsonData("comprobantes-compra.json", lista);
}

export async function registrarRecepcionPedido(datos: {
  id: string;
  empleado: string;
  comprobante: string;
  fechaComprobante: string;
  lineas: { productoId: string; cantidad: number; recibido: number; costo?: number; margen?: number; precioVisible?: number }[];
}) {
  const pedidos = await leerPedidosProveedor();
  const pedido = pedidos.find((p) => p.id === datos.id);
  if (!pedido) return { error: "No encontramos ese pedido." as const };
  const productos = await leerProductos();
  const ajustes = await leerAjustes();
  const pedidas = datos.lineas.filter((l) => l.productoId);
  const ids = new Set(pedidas.map((l) => l.productoId));
  const protegida = pedido.lineas.find(
    (l) => recibidoDeLinea(l, pedido.estado) > 0 && !ids.has(l.productoId),
  );
  if (protegida) {
    return { error: `${protegida.nombre} ya entró y no se puede sacar de la lista.` as const };
  }
  pedido.lineas = pedido.lineas.filter(
    (l) => ids.has(l.productoId) || recibidoDeLinea(l, pedido.estado) > 0,
  );
  for (const marcada of pedidas) {
    if (pedido.lineas.some((l) => l.productoId === marcada.productoId)) continue;
    const producto = productos.find((p) => p.id === marcada.productoId);
    if (!producto) return { error: "Hay un producto que ya no está en el catálogo." as const };
    pedido.lineas.push({
      productoId: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      cantidad: Math.max(1, Math.round(Number(marcada.cantidad)) || 0),
      ...(typeof producto.costo === "number" ? { costo: producto.costo } : {}),
    });
  }
  const cambios: {
    linea: LineaPedidoProveedor;
    nuevo: number;
    delta: number;
    producto: Awaited<ReturnType<typeof leerProductos>>[number] | null;
    costo?: number;
    margen?: number;
    precioVisible?: number;
  }[] = [];
  for (const linea of pedido.lineas) {
    const marcada = pedidas.find((l) => l.productoId === linea.productoId);
    const anterior = recibidoDeLinea(linea, pedido.estado);
    const cantidadPedida = Math.max(
      anterior,
      Math.round(Number(marcada?.cantidad ?? linea.cantidad)) || linea.cantidad,
    );
    linea.cantidad = cantidadPedida;
    const pedidoNuevo = Math.round(Number(marcada?.recibido ?? anterior));
    const nuevo = Math.max(anterior, Math.min(cantidadPedida, Number.isFinite(pedidoNuevo) ? pedidoNuevo : anterior));
    const delta = nuevo - anterior;
    const producto = productos.find((p) => p.id === linea.productoId) ?? null;
    if (delta > 0 && !producto) {
      return { error: `${linea.nombre} ya no está en el catálogo.` as const };
    }
    let costo: number | undefined;
    let margen: number | undefined;
    let precioVisible: number | undefined;
    if (delta > 0) {
      costo = Math.round(Number(marcada?.costo));
      const margenLeido = leerMargen(String(marcada?.margen ?? ""));
      precioVisible = Math.round(Number(marcada?.precioVisible));
      if (!Number.isFinite(costo) || costo < 0) {
        return { error: `Ingresá el costo de factura de ${linea.nombre}.` as const };
      }
      if ("error" in margenLeido || margenLeido.margen === undefined) {
        return { error: `Ingresá el margen de ${linea.nombre}.` as const };
      }
      if (!Number.isFinite(precioVisible) || precioVisible < 1) {
        return { error: `Ingresá el precio de venta de ${linea.nombre}.` as const };
      }
      margen = margenLeido.margen;
    }
    cambios.push({ linea, nuevo, delta, producto, costo, margen, precioVisible });
  }
  const entraAlgo = cambios.some((c) => c.delta > 0);
  const factura = datos.comprobante.trim();
  if (entraAlgo && factura.length < 1) {
    return { error: "Ingresá el número de factura o comprobante." as const };
  }
  if (pedido.lineas.length === 0) return { error: "El pedido tiene que tener al menos un producto." as const };
  const entradas = await leerEntradas();
  let huboEntrada = false;
  const compradas: LineaComprobanteCompra[] = [];
  for (const cambio of cambios) {
    if (cambio.delta !== 0 && cambio.producto) {
      const actual = typeof cambio.producto.stock === "number" ? cambio.producto.stock : 0;
      const stockAnterior = typeof cambio.producto.stock === "number" ? cambio.producto.stock : null;
      cambio.producto.stock = Math.max(0, actual + cambio.delta);
      if (cambio.delta > 0 && cambio.costo != null && cambio.margen != null && cambio.precioVisible != null) {
        const costoAnterior = typeof cambio.producto.costo === "number" ? cambio.producto.costo : null;
        cambio.producto.costo = cambio.costo;
        cambio.producto.margen = cambio.margen;
        cambio.producto.precio = precioBase(cambio.precioVisible, cambio.producto.seccion, ajustes.ajustePorSeccion);
        cambio.producto.precioMayorista = Math.round(cambio.producto.precio * 0.9);
        cambio.linea.costo = cambio.costo;
        huboEntrada = true;
        compradas.push({
          productoId: cambio.producto.id,
          codigo: cambio.producto.codigo,
          nombre: cambio.producto.nombre,
          cantidad: cambio.delta,
          costo: cambio.costo,
        });
        entradas.unshift({
          id: randomUUID(),
          productoId: cambio.producto.id,
          codigo: cambio.producto.codigo,
          nombre: cambio.producto.nombre,
          cantidad: cambio.delta,
          stockAnterior,
          stockNuevo: cambio.producto.stock,
          costoAnterior,
          costoNuevo: cambio.costo,
          margen: cambio.margen,
          precio: cambio.precioVisible,
          empleado: datos.empleado.trim() || "Caja",
          creadoEn: new Date().toISOString(),
        });
      }
    }
    cambio.linea.recibido = cambio.nuevo;
  }
  const completo = pedido.lineas.every((l) => (l.recibido ?? 0) >= l.cantidad);
  const alguno = pedido.lineas.some((l) => (l.recibido ?? 0) > 0);
  pedido.estado = completo ? "recibido" : alguno ? "parcial" : "pedido";
  if (completo) pedido.recibidoEn = new Date().toISOString();
  else delete pedido.recibidoEn;
  if (factura) pedido.factura = factura;
  await guardarProductos(productos);
  await escribirJsonData("pedidos-proveedor.json", pedidos);
  if (huboEntrada) {
    await escribirJsonData("entradas-stock.json", entradas.slice(0, 80));
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(datos.fechaComprobante)
      ? datos.fechaComprobante
      : new Date().toISOString().slice(0, 10);
    await guardarComprobante({
      id: randomUUID(),
      numero: factura,
      fecha,
      proveedorId: pedido.proveedorId,
      proveedorNombre: pedido.proveedorNombre,
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero,
      origen: "pedido",
      lineas: compradas,
      total: compradas.reduce((suma, linea) => suma + linea.costo * linea.cantidad, 0),
      empleado: datos.empleado.trim() || "Caja",
      creadoEn: new Date().toISOString(),
    });
  }
  return { ok: true as const, numero: pedido.numero, estado: pedido.estado };
}

export async function quitarPedidoProveedor(id: string) {
  const pedidos = await leerPedidosProveedor();
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) return { error: "No encontramos ese pedido." as const };
  if (pedido.estado !== "pedido" || pedido.lineas.some((l) => recibidoDeLinea(l, pedido.estado) > 0)) {
    return { error: "Un pedido con mercadería recibida no se puede borrar." as const };
  }
  await escribirJsonData(
    "pedidos-proveedor.json",
    pedidos.filter((p) => p.id !== id),
  );
  return { ok: true as const, numero: pedido.numero };
}

export async function leerRegularizaciones(): Promise<RegularizacionStock[]> {
  const lista = await leerJsonData<RegularizacionStock[]>("regularizaciones.json", []);
  return Array.isArray(lista) ? lista : [];
}

export async function regularizarStock(datos: {
  productoId: string;
  contado: number;
  empleado: string;
}) {
  const contado = Math.round(Number(datos.contado));
  if (!Number.isFinite(contado) || contado < 0) {
    return { error: "El stock contado no puede ser negativo." as const };
  }
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === datos.productoId);
  if (!producto) return { error: "No encontramos ese producto." as const };
  const anterior = typeof producto.stock === "number" ? producto.stock : null;
  const guardado = await guardarStockProducto(
    producto.id,
    contado,
    producto.mostrarEnCaja !== false,
  );
  if ("error" in guardado) return { error: guardado.error };
  const movimiento: RegularizacionStock = {
    id: randomUUID(),
    productoId: producto.id,
    codigo: producto.codigo,
    nombre: producto.nombre,
    anterior,
    nuevo: contado,
    empleado: datos.empleado,
    creadoEn: new Date().toISOString(),
  };
  const lista = await leerRegularizaciones();
  lista.unshift(movimiento);
  await escribirJsonData("regularizaciones.json", lista.slice(0, 80));
  return { ok: true as const, movimiento };
}

export type EntradaStock = {
  id: string;
  productoId: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  stockAnterior: number | null;
  stockNuevo: number;
  costoAnterior: number | null;
  costoNuevo: number;
  margen: number;
  precio: number;
  empleado: string;
  creadoEn: string;
};

export async function leerEntradas(): Promise<EntradaStock[]> {
  const lista = await leerJsonData<EntradaStock[]>("entradas-stock.json", []);
  return Array.isArray(lista) ? lista : [];
}

function precioBase(visible: number, seccion: string, extra: Record<string, number>) {
  const factor = 1 + (extra[seccion] ?? 0) / 100;
  return factor === 0 ? Math.round(visible) : Math.round(visible / factor);
}

export async function entrarStock(datos: {
  productoId: string;
  cantidad: number;
  costo: number;
  margen: number;
  precioVisible: number;
  empleado: string;
}) {
  const cantidad = Math.round(Number(datos.cantidad));
  const costo = Math.round(Number(datos.costo));
  const margenLeido = leerMargen(String(datos.margen));
  const precioVisible = Math.round(Number(datos.precioVisible));
  if (!Number.isFinite(cantidad) || cantidad < 1) {
    return { error: "La cantidad que entra tiene que ser al menos 1." as const };
  }
  if (!Number.isFinite(costo) || costo < 0) {
    return { error: "El costo no puede ser negativo." as const };
  }
  if ("error" in margenLeido || margenLeido.margen === undefined) {
    return { error: "error" in margenLeido ? margenLeido.error : ("Ingresá el margen de ganancia." as const) };
  }
  if (!Number.isFinite(precioVisible) || precioVisible < 1) {
    return { error: "El precio de venta tiene que ser mayor a 0." as const };
  }
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === datos.productoId);
  if (!producto) return { error: "No encontramos ese producto." as const };
  const ajustes = await leerAjustes();
  const anterior = typeof producto.stock === "number" ? producto.stock : null;
  const costoAnterior = typeof producto.costo === "number" ? producto.costo : null;
  producto.stock = (anterior ?? 0) + cantidad;
  producto.costo = costo;
  producto.margen = margenLeido.margen;
  producto.precio = precioBase(precioVisible, producto.seccion, ajustes.ajustePorSeccion);
  producto.precioMayorista = Math.round(producto.precio * 0.9);
  await guardarProductos(productos);
  const entrada: EntradaStock = {
    id: randomUUID(),
    productoId: producto.id,
    codigo: producto.codigo,
    nombre: producto.nombre,
    cantidad,
    stockAnterior: anterior,
    stockNuevo: producto.stock,
    costoAnterior,
    costoNuevo: costo,
    margen: margenLeido.margen,
    precio: precioVisible,
    empleado: datos.empleado,
    creadoEn: new Date().toISOString(),
  };
  const lista = await leerEntradas();
  lista.unshift(entrada);
  await escribirJsonData("entradas-stock.json", lista.slice(0, 80));
  return { ok: true as const, entrada };
}

export async function registrarComprobanteDirecto(datos: {
  numero: string;
  fecha: string;
  proveedorId: string;
  empleado: string;
  lineas: { productoId: string; cantidad: number; costo: number; margen: number; precioVisible: number }[];
}) {
  const numero = datos.numero.trim();
  if (numero.length < 1) return { error: "Ingresá el número de factura o comprobante." as const };
  const proveedores = await leerProveedores();
  const proveedor = proveedores.find((p) => p.id === datos.proveedorId);
  if (!proveedor) return { error: "Elegí el proveedor." as const };
  if (datos.lineas.length === 0) return { error: "Agregá los artículos que entraron." as const };
  const productos = await leerProductos();
  const ajustes = await leerAjustes();
  const entradas = await leerEntradas();
  const compradas: LineaComprobanteCompra[] = [];
  for (const linea of datos.lineas) {
    const cantidad = Math.round(Number(linea.cantidad));
    const costo = Math.round(Number(linea.costo));
    const margenLeido = leerMargen(String(linea.margen));
    const precioVisible = Math.round(Number(linea.precioVisible));
    const producto = productos.find((p) => p.id === linea.productoId);
    if (!producto) return { error: "Hay un producto que ya no está en el catálogo." as const };
    if (!Number.isFinite(cantidad) || cantidad < 1) {
      return { error: `La cantidad de ${producto.nombre} tiene que ser al menos 1.` as const };
    }
    if (!Number.isFinite(costo) || costo < 0) {
      return { error: `Ingresá el costo de factura de ${producto.nombre}.` as const };
    }
    if ("error" in margenLeido || margenLeido.margen === undefined) {
      return { error: `Ingresá el margen de ${producto.nombre}.` as const };
    }
    if (!Number.isFinite(precioVisible) || precioVisible < 1) {
      return { error: `Ingresá el precio de venta de ${producto.nombre}.` as const };
    }
    const anterior = typeof producto.stock === "number" ? producto.stock : null;
    const costoAnterior = typeof producto.costo === "number" ? producto.costo : null;
    producto.stock = (anterior ?? 0) + cantidad;
    producto.costo = costo;
    producto.margen = margenLeido.margen;
    producto.precio = precioBase(precioVisible, producto.seccion, ajustes.ajustePorSeccion);
    producto.precioMayorista = Math.round(producto.precio * 0.9);
    compradas.push({
      productoId: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      cantidad,
      costo,
    });
    entradas.unshift({
      id: randomUUID(),
      productoId: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      cantidad,
      stockAnterior: anterior,
      stockNuevo: producto.stock,
      costoAnterior,
      costoNuevo: costo,
      margen: margenLeido.margen,
      precio: precioVisible,
      empleado: datos.empleado.trim() || "Caja",
      creadoEn: new Date().toISOString(),
    });
  }
  await guardarProductos(productos);
  await escribirJsonData("entradas-stock.json", entradas.slice(0, 80));
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) ? datos.fecha : new Date().toISOString().slice(0, 10);
  const total = compradas.reduce((suma, linea) => suma + linea.costo * linea.cantidad, 0);
  await guardarComprobante({
    id: randomUUID(),
    numero,
    fecha,
    proveedorId: proveedor.id,
    proveedorNombre: proveedor.nombre,
    origen: "directa",
    lineas: compradas,
    total,
    empleado: datos.empleado.trim() || "Caja",
    creadoEn: new Date().toISOString(),
  });
  return { ok: true as const, numero, total, articulos: compradas.length };
}

export async function actualizarInventario(datos: {
  productoId: string;
  stock: string;
  stockMinimo: string;
  costo: string;
  margen: string;
  precioVisible: string;
  proveedorId: string;
}) {
  const stock = leerEnteroOpcional(datos.stock, "El stock");
  const minimo = leerEnteroOpcional(datos.stockMinimo, "El stock mínimo");
  const costo = leerEnteroOpcional(datos.costo, "El costo");
  const margen = leerMargen(datos.margen);
  const precioVisible = Math.round(Number(String(datos.precioVisible).replace(/[^\d]/g, "")));
  if ("error" in stock) return { error: stock.error as string };
  if ("error" in minimo) return { error: minimo.error as string };
  if ("error" in costo) return { error: costo.error as string };
  if ("error" in margen) return { error: margen.error };
  if (!Number.isFinite(precioVisible) || precioVisible < 1) {
    return { error: "El precio de venta tiene que ser mayor a 0." as const };
  }
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === datos.productoId);
  if (!producto) return { error: "No encontramos ese producto." as const };
  if (datos.proveedorId) {
    const proveedores = await leerProveedores();
    if (!proveedores.some((p) => p.id === datos.proveedorId)) {
      return { error: "Elegí un proveedor cargado." as const };
    }
    producto.proveedorId = datos.proveedorId;
  } else {
    delete producto.proveedorId;
  }
  if (stock.valor === undefined) delete producto.stock;
  else producto.stock = stock.valor;
  if (minimo.valor === undefined) delete producto.stockMinimo;
  else producto.stockMinimo = minimo.valor;
  if (costo.valor === undefined) delete producto.costo;
  else producto.costo = costo.valor;
  if (margen.margen === undefined) delete producto.margen;
  else producto.margen = margen.margen;
  const ajustes = await leerAjustes();
  producto.precio = precioBase(precioVisible, producto.seccion, ajustes.ajustePorSeccion);
  producto.precioMayorista = Math.round(producto.precio * 0.9);
  await guardarProductos(productos);
  return { ok: true as const, codigo: producto.codigo };
}
