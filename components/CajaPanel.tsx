"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  anularVenta,
  cobrarVenta,
  generarDeudaVenta,
  registrarRetiroCaja,
  type EstadoCaja,
} from "@/app/acciones/caja";
import { CajaCierre, type ComprobanteCaja, type PagoCierre } from "@/components/CajaCierre";
import { salir } from "@/app/acciones/auth";
import { ID_LINEA_ENVIO } from "@/lib/carrito";
import { costoEnvio, etiquetaCostoEnvio } from "@/lib/envio";
import { digitosMonto, formatoPesos, nombreVitrina, textoMonto } from "@/lib/format";
import type { EscalaEnvio } from "@/types/ajustes";
import type { MedioPago } from "@/lib/medios-pago";
import { diaArgentina, etiquetaFormaPago, fechaHoraVenta, nombreVisible } from "@/lib/venta-texto";
import type { ComprobanteCompra } from "@/lib/deposito";
import type { RetiroCaja } from "@/lib/retiros-caja";
import type { VentaCaja } from "@/lib/caja";
import type { EntradaStock } from "@/lib/deposito";
import {
  IconoAdmin,
  IconoCliente,
  IconoDeuda,
  IconoListado,
  IconoMantenimiento,
  IconoProducto,
  IconoStock,
  IconoVenta,
  TarjetaAccion,
} from "@/components/CajaIconos";
import type { PermisoCaja } from "@/lib/permisos-caja";
import { CajaListados } from "@/components/CajaListados";
import {
  CajaDeposito,
  type CompraCaja,
  type DeudaCaja,
  type PersonaCaja,
} from "@/components/CajaDeposito";
import { AdminClienteActividad } from "@/components/AdminClienteActividad";
import { AdminCuentasLista } from "@/components/AdminCuentasLista";
import { CajaBuscarCliente } from "@/components/CajaBuscarCliente";
import { CajaUltimasVentas } from "@/components/CajaUltimasVentas";
import { AdminAlarma } from "@/components/AdminAlarma";
import { caja } from "@/components/caja-estilo";
import {
  CANAL_CAJA_PEDIDO,
  CLAVE_CAJA_PEDIDO,
  leerPedidoEnCaja,
  limpiarPedidoEnCaja,
  type CargaPedidoCaja,
} from "@/lib/caja-pedido-web";
import type { AlertasAdmin } from "@/types/cuenta";
import type { PedidoProveedor, Proveedor, RegularizacionStock } from "@/lib/deposito";
import type { NovedadAdmin, ResumenCliente, SolicitudCuenta } from "@/types/cuenta";
import type { Producto } from "@/types/producto";
import type { Rubro } from "@/types/rubro";

export type ProductoCaja = {
  id: string;
  codigo: string;
  nombre: string;
  seccion: string;
  precio: number;
  stock: number | null;
  stockMinimo: number | null;
  costo: number | null;
  margen: number | null;
  proveedorId: string;
  mostrarEnCaja: boolean;
  codigosBarra?: string[];
};

const POR_PAGINA = 12;
type Vista = "inicio" | "empleado" | "venta" | "cierre" | "listados" | "stock" | "clientes" | "productos" | "mantenimiento" | "deudas";
type Linea = { id: string; cantidad: number; precio?: number };

const GRILLA_TICKET = "grid grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_5.5rem] items-center gap-1";

export function CajaPanel({
  productos,
  rubros,
  ventas,
  historial,
  empleado,
  ultimaFactura,
  esAdmin,
  proveedores,
  pedidosProveedor,
  regularizaciones,
  entradas,
  personas,
  deudas,
  compras,
  fichaProductos,
  fichaRubros,
  descuentoClienteGenerico,
  tasasCuota,
  moraCredito,
  moraCuenta,
  plazoCuenta,
  permisos,
  ajustePorSeccion,
  mediosPago,
  fichas,
  novedades,
  solicitudes,
  alertasIniciales,
  retiros,
  comprobantes,
  envio,
}: {
  productos: ProductoCaja[];
  rubros: { clave: string; etiqueta: string }[];
  ventas: VentaCaja[];
  historial: VentaCaja[];
  empleado: string;
  ultimaFactura: number;
  esAdmin: boolean;
  proveedores: Proveedor[];
  pedidosProveedor: PedidoProveedor[];
  regularizaciones: RegularizacionStock[];
  entradas: EntradaStock[];
  personas: PersonaCaja[];
  deudas: DeudaCaja[];
  compras: CompraCaja[];
  fichaProductos: Producto[];
  fichaRubros: Rubro[];
  descuentoClienteGenerico: number;
  tasasCuota: { 1: number; 2: number; 3: number; 6: number };
  moraCredito: number[];
  moraCuenta: number[];
  plazoCuenta: number;
  permisos: PermisoCaja[];
  ajustePorSeccion: Record<string, number>;
  mediosPago: MedioPago[];
  fichas: ResumenCliente[];
  novedades: NovedadAdmin[];
  solicitudes: SolicitudCuenta[];
  alertasIniciales: AlertasAdmin;
  retiros: RetiroCaja[];
  comprobantes: ComprobanteCompra[];
  envio: EscalaEnvio;
}) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("inicio");
  const [seccion, setSeccion] = useState(rubros[0]?.clave ?? "");
  const [pagina, setPagina] = useState(0);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pedidoWeb, setPedidoWeb] = useState<CargaPedidoCaja | null>(null);
  const pedidoWebId = pedidoWeb?.pedidoId ?? "";
  const pedidoWebNumero = pedidoWeb?.numero ?? "";
  const [cliente, setCliente] = useState("Cliente genérico");
  const [clienteVenta, setClienteVenta] = useState<PersonaCaja | null>(null);
  const [comprobante, setComprobante] = useState<ComprobanteCaja | null>(null);
  const [codigo, setCodigo] = useState("");
  const codigoRef = useRef<HTMLInputElement>(null);
  const [cartel, setCartel] = useState<ComprobanteCaja | null>(null);
  const [retiroAbierto, setRetiroAbierto] = useState(false);
  const [conceptoRetiro, setConceptoRetiro] = useState("");
  const [montoRetiro, setMontoRetiro] = useState("");
  const [mensaje, setMensaje] = useState<EstadoCaja>(null);
  const [reloj, setReloj] = useState("");
  const [empleadoTurno, setEmpleadoTurno] = useState<PersonaCaja | null>(null);
  const [buscarProductos, setBuscarProductos] = useState(false);
  const [ultimasAbiertas, setUltimasAbiertas] = useState(false);
  const [deudaAbierta, setDeudaAbierta] = useState<string | null>(null);
  const panelDeudas = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const empleados = useMemo(
    () =>
      personas
        .filter((p) => p.rol === "caja" || p.rol === "admin")
        .slice()
        .sort((a, b) => nombreVisible(a).localeCompare(nombreVisible(b), "es")),
    [personas],
  );

  useEffect(() => {
    const pintar = () => {
      setReloj(
        new Intl.DateTimeFormat("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: "America/Argentina/Buenos_Aires",
        }).format(new Date()),
      );
    };
    pintar();
    const id = window.setInterval(pintar, 15000);
    return () => window.clearInterval(id);
  }, []);

  function terminarVenta() {
    if (lineas.length === 0 || pending) return;
    setBuscarProductos(false);
    setComprobante(null);
    setMensaje(null);
    setVista("cierre");
  }

  useEffect(() => {
    if (!cartel) return;
    const id = window.setTimeout(() => setCartel(null), 8000);
    return () => window.clearTimeout(id);
  }, [cartel]);

  useEffect(() => {
    if (vista === "venta") codigoRef.current?.focus();
  }, [vista]);

  useEffect(() => {
    if (vista !== "venta") return;
    function tecla(e: KeyboardEvent) {
      if (e.key === "F6") {
        e.preventDefault();
        setBuscarProductos((abierto) => !abierto);
      }
      if (e.key === "F9") {
        e.preventDefault();
        terminarVenta();
      }
      if (e.key === "Escape") setBuscarProductos(false);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [vista, lineas.length, pending]);

  useEffect(() => {
    panelDeudas.current?.scrollTo({ top: 0 });
  }, [deudaAbierta, vista]);

  const fecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());

  const porId = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos],
  );
  const etiqueta = useMemo(
    () => Object.fromEntries(rubros.map((r) => [r.clave, r.etiqueta])),
    [rubros],
  );
  const deSeccion = productos.filter(
    (p) => p.seccion === seccion && p.mostrarEnCaja,
  );
  const paginas = Math.max(1, Math.ceil(deSeccion.length / POR_PAGINA));
  const visibles = deSeccion.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const descuentoVenta = clienteVenta?.descuento ?? 0;
  function precioDeLinea(l: Linea, envioEscala: number) {
    if (typeof l.precio === "number" && Number.isFinite(l.precio)) return Math.max(0, Math.round(l.precio));
    if (l.id === ID_LINEA_ENVIO) return envioEscala;
    const p = porId.get(l.id);
    if (!p) return 0;
    return descuentoVenta > 0 ? Math.round(p.precio * (1 - descuentoVenta / 100)) : p.precio;
  }
  const subtotalProductosVenta = lineas.reduce((suma, l) => {
    if (l.id === ID_LINEA_ENVIO) return suma;
    return suma + precioDeLinea(l, 0) * l.cantidad;
  }, 0);
  const llevaEnvio = lineas.some((l) => l.id === ID_LINEA_ENVIO);
  const precioEnvio = llevaEnvio ? costoEnvio(subtotalProductosVenta, envio) : 0;
  const total = lineas.reduce((suma, l) => suma + precioDeLinea(l, precioEnvio) * l.cantidad, 0);
  const unidades = lineas.reduce((suma, l) => suma + l.cantidad, 0);
  const ventasOk = ventas.filter((v) => !v.anulada);
  const totalDia = ventasOk.reduce((suma, v) => suma + v.total, 0);
  const ultima = ventasOk[0] ?? null;

  function agregar(id: string) {
    const p = porId.get(id);
    if (!p) return;
    setLineas((prev) => {
      const actual = prev.find((l) => l.id === id);
      const siguiente = (actual?.cantidad ?? 0) + 1;
      if (p.stock != null && siguiente > p.stock) {
        setMensaje({ error: `Quedan ${p.stock} de ${nombreVitrina(p.nombre)}.` });
        return prev;
      }
      setMensaje(null);
      if (actual) {
        return prev.map((l) =>
          l.id === id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [...prev, { id, cantidad: 1 }];
    });
  }

  function setCantidad(id: string, cantidad: number) {
    setLineas((prev) => {
      if (cantidad < 1) return prev.filter((l) => l.id !== id);
      const p = porId.get(id);
      if (p?.stock != null && cantidad > p.stock) {
        setMensaje({ error: `Quedan ${p.stock} de ${nombreVitrina(p.nombre)}.` });
        return prev;
      }
      return prev.map((l) => (l.id === id ? { ...l, cantidad } : l));
    });
  }

  function buscarCodigo(valor: string) {
    const q = valor.trim().toLowerCase();
    if (!q) return;
    const exacto =
      productos.find((item) => item.codigo.toLowerCase() === q) ??
      productos.find((item) =>
        (item.codigosBarra ?? []).some((codigo) => codigo.toLowerCase() === q),
      );
    const p =
      exacto ??
      productos.find((item) => item.nombre.toLowerCase().includes(q));
    if (!p) {
      setMensaje({ error: "No hay un producto con ese código." });
      return;
    }
    if (!p.mostrarEnCaja) {
      setMensaje({ error: "Ese producto no está habilitado en caja." });
      return;
    }
    if (p.seccion !== seccion) {
      setSeccion(p.seccion);
      setPagina(0);
    }
    agregar(p.id);
    setCodigo("");
    codigoRef.current?.focus();
  }

  function datosVenta(extra: {
    cliente: string;
    email?: string;
    telefono?: string;
    clienteId?: string;
    formaPago?: PagoCierre;
  }) {
    const data = new FormData();
    data.set("cliente", extra.cliente);
    data.set("email", extra.email ?? "");
    data.set("telefono", extra.telefono ?? "");
    data.set("clienteId", extra.clienteId ?? "");
    data.set("empleadoId", empleadoTurno?.id ?? "");
    if (extra.formaPago) data.set("formaPago", extra.formaPago);
    data.set(
      "lineas",
      JSON.stringify(
        lineas.map((l) => ({
          productoId: l.id,
          cantidad: l.cantidad,
          precio: precioDeLinea(l, precioEnvio),
        })),
      ),
    );
    if (pedidoWebId) data.set("pedidoWebId", pedidoWebId);
    return data;
  }

  function soltarPedidoWeb() {
    setPedidoWeb(null);
    limpiarPedidoEnCaja();
  }

  function fijarPrecio(id: string, valor: string) {
    if (pedidoWebId) return;
    const precio = Number(digitosMonto(valor)) || 0;
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, precio } : l)));
  }

  function detalleActual() {
    return lineas.map((l) => {
      if (l.id === ID_LINEA_ENVIO) {
        const precio = precioDeLinea(l, precioEnvio);
        return {
          codigo: "ENVIO",
          nombre: etiquetaCostoEnvio(precio),
          cantidad: 1,
          precio,
        };
      }
      const p = porId.get(l.id);
      return {
        codigo: p?.codigo ?? "",
        nombre: p?.nombre ?? "Producto",
        cantidad: l.cantidad,
        precio: precioDeLinea(l, precioEnvio),
      };
    });
  }

  function generarPresupuesto() {
    if (!clienteVenta || lineas.length === 0 || pending) return;
    start(async () => {
      const res = await fetch("/caja/presupuesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: nombreVisible(clienteVenta),
          telefono: clienteVenta.telefono,
          email: clienteVenta.email,
          descuento: clienteVenta.descuento,
          lineas: detalleActual(),
        }),
      });
      if (!res.ok) {
        const texto = await res.text();
        setMensaje({ error: texto || "No se pudo armar el presupuesto." });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `presupuesto-${nombreVisible(clienteVenta).replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMensaje({ ok: "📄 Presupuesto PDF generado." });
    });
  }

  function alternarEnvio() {
    setLineas((prev) =>
      prev.some((l) => l.id === ID_LINEA_ENVIO)
        ? prev.filter((l) => l.id !== ID_LINEA_ENVIO)
        : [...prev, { id: ID_LINEA_ENVIO, cantidad: 1 }],
    );
  }

  function seguirVendiendo(comp: ComprobanteCaja) {
    setLineas([]);
    soltarPedidoWeb();
    setCliente("Cliente genérico");
    setClienteVenta(null);
    setComprobante(null);
    setMensaje(null);
    setCartel(comp);
    setVista("venta");
    window.setTimeout(() => codigoRef.current?.focus(), 0);
  }

  function cerrarCobrando(datos: {
    cliente: string;
    formaPago: PagoCierre;
    email: string;
    clienteId?: string;
    efectivoMixto?: number;
    transferenciaMixto?: number;
  }) {
    const snapshot = detalleActual();
    const importe = total;
    const forma =
      datos.formaPago === "mixto"
        ? `Efectivo ${formatoPesos(datos.efectivoMixto ?? 0)} + Transferencia ${formatoPesos(datos.transferenciaMixto ?? 0)}`
        : datos.formaPago;
    setCliente(datos.cliente);
    setMensaje(null);
    start(async () => {
      const data = datosVenta({ ...datos, formaPago: datos.formaPago });
      if (datos.formaPago === "mixto") {
        data.set("efectivoMixto", String(datos.efectivoMixto ?? 0));
        data.set("transferenciaMixto", String(datos.transferenciaMixto ?? 0));
      }
      const r = await cobrarVenta(data);
      if (r?.ventaId && r.numero) {
        seguirVendiendo({
          id: r.ventaId,
          numero: r.numero,
          forma,
          cliente: datos.cliente,
          total: importe,
          lineas: snapshot,
        });
        router.refresh();
        return;
      }
      setMensaje(r);
    });
  }

  function cerrarEnDeuda(datos: {
    cliente: string;
    email: string;
    telefono: string;
    clienteId?: string;
  }) {
    const snapshot = detalleActual();
    const importe = total;
    setCliente(datos.cliente);
    setMensaje(null);
    start(async () => {
      const r = await generarDeudaVenta(datosVenta(datos));
      if (r?.ventaId && r.numero) {
        seguirVendiendo({
          id: r.ventaId,
          numero: r.numero,
          forma: "deuda",
          cliente: datos.cliente,
          total: importe,
          lineas: snapshot,
        });
        router.refresh();
        return;
      }
      setMensaje(r);
    });
  }

  function abrirVenta(nueva: boolean) {
    if (nueva) {
      setLineas([]);
      soltarPedidoWeb();
      setCliente("Cliente genérico");
      setClienteVenta(null);
      setComprobante(null);
      setCartel(null);
      setMensaje(null);
      setVista(empleadoTurno ? "venta" : "empleado");
      return;
    }
    setMensaje(null);
    setEmpleadoTurno(null);
    setVista("empleado");
  }

  function guardarRetiro() {
    const data = new FormData();
    data.set("empleadoId", empleadoTurno?.id ?? "");
    data.set("concepto", conceptoRetiro);
    data.set("monto", montoRetiro);
    start(async () => {
      const r = await registrarRetiroCaja(data);
      setMensaje(r);
      if (r?.ok) {
        setConceptoRetiro("");
        setMontoRetiro("");
        setRetiroAbierto(false);
        router.refresh();
      }
    });
  }

  function confirmarEmpleado() {
    if (!empleadoTurno) {
      setMensaje({ error: "Elegí el empleado que está usando la caja." });
      return;
    }
    setMensaje(null);
    setVista("venta");
  }

  const empleadoRef = useRef(empleadoTurno);
  empleadoRef.current = empleadoTurno;

  useEffect(() => {
    function tomar(data: CargaPedidoCaja | null) {
      if (!data?.pedidoId) return;
      const nuevas: Linea[] = [];
      const faltan: string[] = [];
      for (const linea of data.lineas) {
        const precio =
          typeof linea.precio === "number" && Number.isFinite(linea.precio)
            ? Math.max(0, Math.round(linea.precio))
            : undefined;
        if (String(linea.codigo).toUpperCase() === "ENVIO") {
          nuevas.push({ id: ID_LINEA_ENVIO, cantidad: 1, ...(precio !== undefined ? { precio } : {}) });
          continue;
        }
        const producto = productos.find((p) => p.codigo.toLowerCase() === String(linea.codigo).toLowerCase());
        if (!producto) faltan.push(linea.codigo || "sin código");
        else {
          nuevas.push({
            id: producto.id,
            cantidad: Math.max(1, Math.round(linea.cantidad) || 1),
            ...(precio !== undefined ? { precio } : {}),
          });
        }
      }
      if (nuevas.length === 0) {
        setMensaje({ error: "Ese pedido no tiene productos que estén en la caja." });
        return;
      }
      setLineas(nuevas);
      setPedidoWeb(data);
      setComprobante(null);
      const persona = personas.find(
        (p) => data.email && p.email.toLowerCase() === data.email.toLowerCase(),
      );
      if (persona) {
        setClienteVenta(persona);
        setCliente(nombreVisible(persona));
      } else {
        setClienteVenta(null);
        setCliente(data.cliente || "Cliente genérico");
      }
      setMensaje(
        faltan.length
          ? { error: `Cargamos el pedido ${data.numero}. No están en la caja: ${faltan.join(", ")}.` }
          : { ok: `Pedido ${data.numero} cargado. Cerrá la venta para marcarlo como enviando.` },
      );
      setVista(empleadoRef.current ? "venta" : "empleado");
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== CLAVE_CAJA_PEDIDO || !e.newValue) return;
      try {
        tomar(JSON.parse(e.newValue) as CargaPedidoCaja);
      } catch {
        /* pedido ilegible */
      }
    }
    window.addEventListener("storage", onStorage);
    let canal: BroadcastChannel | null = null;
    try {
      canal = new BroadcastChannel(CANAL_CAJA_PEDIDO);
      canal.onmessage = (evento) => tomar(evento.data as CargaPedidoCaja);
    } catch {
      /* este navegador no tiene BroadcastChannel */
    }
    tomar(leerPedidoEnCaja());
    return () => {
      window.removeEventListener("storage", onStorage);
      canal?.close();
    };
  }, [productos, personas]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <AdminAlarma inicial={alertasIniciales} enCaja />
      {pedidoWebId && (
        <p className="shrink-0 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">
          Pedido web {pedidoWebNumero || ""} cargado. Los precios quedan los del pedido. Al cobrarlo pasa a enviando y, 30 minutos después, a entregado.
        </p>
      )}
      <header className={`${caja.header} shrink-0`}>
        <p className={caja.marca}>La Triple L</p>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Caja</p>
        <p className={caja.reloj}>{reloj || " "}</p>
        <p className={`${caja.meta} capitalize`}>{fecha}</p>
        <p className={caja.meta}>
          Última factura: <span className={caja.metaFuerte}>{ultimaFactura || "—"}</span>
        </p>
        <button
          type="button"
          onClick={() => abrirVenta(true)}
          className={caja.botonHeaderPrimario}
        >
          🛒 Nueva venta
        </button>
        <button
          type="button"
          onClick={() => setUltimasAbiertas(true)}
          className="rounded-xl bg-cape px-3 py-2 text-sm font-bold text-white transition hover:brightness-110"
        >
          ↩️ Devolución
        </button>
        <p className={caja.meta}>
          Empleado:{" "}
          <span className={caja.metaFuerte}>
            {vista === "empleado"
              ? empleadoTurno
                ? nombreVisible(empleadoTurno)
                : "sin confirmar"
              : empleadoTurno
                ? nombreVisible(empleadoTurno)
                : empleado}
          </span>
        </p>
        <p className={caja.meta}>
          Hoy {formatoPesos(totalDia)} · {ventasOk.length} ventas
        </p>
        <div className="ml-auto flex gap-2">
          {esAdmin && (
            <a href="/admin/pedidos" className={caja.botonHeader}>
              Admin
            </a>
          )}
          <button type="button" onClick={() => setVista("inicio")} className={caja.botonHeader}>
            Menú
          </button>
          <form action={salir}>
            <button type="submit" className={caja.botonHeader}>
              Salir
            </button>
          </form>
        </div>
      </header>

      {mensaje?.error && <p className={caja.avisoError}>{mensaje.error}</p>}
      {mensaje?.ok && <p className={caja.avisoOk}>{mensaje.ok}</p>}

      {(vista === "inicio" || vista === "empleado") && (
        <div className="min-h-0 flex-1 overflow-auto">
      {vista === "inicio" && (
        <MenuCaja
          esAdmin={esAdmin}
          permisos={permisos}
          onVenta={() => abrirVenta(false)}
          onListados={() => setVista("listados")}
          onStock={() => setVista("stock")}
          onClientes={() => setVista("clientes")}
          onProductos={() => setVista("productos")}
          onMantenimiento={() => setVista("mantenimiento")}
          onDeudas={() => {
            setDeudaAbierta(null);
            setVista("deudas");
          }}
        />
      )}

      {vista === "empleado" && (
        <ElegirEmpleado
          empleados={empleados}
          elegidoId={empleadoTurno?.id ?? ""}
          onElegir={setEmpleadoTurno}
          onConfirmar={confirmarEmpleado}
          onCancelar={() => {
            setEmpleadoTurno(null);
            setMensaje(null);
            setVista("inicio");
          }}
        />
      )}
        </div>
      )}

      {vista === "venta" && (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(18.5rem,26rem)]">
          <section className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {cartel && (
              <div className="mb-3 rounded-2xl bg-movipack-deep px-4 py-3 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-confetti">Última venta</p>
                    <p className="font-display text-2xl font-bold">
                      Factura {cartel.numero} · {formatoPesos(cartel.total)}
                    </p>
                    <p className="text-sm text-white/80">
                      {cartel.cliente} · {etiquetaFormaPago(cartel.forma)}
                    </p>
                    <p className="mt-1 text-xs text-white/70">
                      {cartel.lineas.map((l) => `${l.cantidad} ${nombreVitrina(l.nombre)} ${formatoPesos(l.precio * l.cantidad)}`).join(" · ")}
                    </p>
                  </div>
                  <button type="button" className="text-sm font-bold text-confetti" onClick={() => setCartel(null)}>
                    Cerrar
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">
                  <a href={`/caja/comprobante/${cartel.id}?formato=ticket`} className="underline">
                    Ticket
                  </a>
                  <a href={`/caja/comprobante/${cartel.id}?formato=a4`} className="underline">
                    Factura A4
                  </a>
                </div>
              </div>
            )}
            <CajaBuscarCliente
              personas={personas}
              deudas={deudas}
              compras={compras}
              cliente={clienteVenta}
              esAdmin={esAdmin}
              tasasCuota={tasasCuota}
              moraCredito={moraCredito}
              moraCuenta={moraCuenta}
              plazoGeneral={plazoCuenta}
              onAbrirDeudas={() => {
                setDeudaAbierta(null);
                setVista("deudas");
              }}
              onElegir={(persona) => {
                setClienteVenta(persona);
                setCliente(persona ? nombreVisible(persona) : "Cliente genérico");
              }}
            />
            {clienteVenta && lineas.length > 0 && (
              <div className="mb-3 rounded-2xl border-2 border-movipack/40 bg-movipack/5 p-3">
                <p className="mb-2 text-sm font-semibold text-neutral-700">
                  Cliente {nombreVisible(clienteVenta)} · {unidades} ítems · {formatoPesos(total)}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  className={`${caja.primario} inline-flex h-12 w-full items-center justify-center gap-2 sm:w-auto`}
                  onClick={generarPresupuesto}
                >
                  📄 Generar presupuesto PDF
                </button>
              </div>
            )}
            <p className={caja.kicker}>Secciones</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
              {rubros.map((r) => (
                <button
                  key={r.clave}
                  type="button"
                  onClick={() => {
                    setSeccion(r.clave);
                    setPagina(0);
                  }}
                  className={`${caja.chip} ${seccion === r.clave ? caja.chipActivo : caja.chipIdle}`}
                >
                  {r.etiqueta}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-lg">
                Productos de{" "}
                <span className="font-display text-xl font-bold">{etiqueta[seccion] ?? "sección"}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={caja.pager}
                  onClick={() => setPagina((n) => Math.max(0, n - 1))}
                  aria-label="Productos anteriores"
                >
                  ‹
                </button>
                <span className="text-sm font-bold">
                  {pagina + 1}/{paginas}
                </span>
                <button
                  type="button"
                  className={caja.pager}
                  onClick={() => setPagina((n) => Math.min(paginas - 1, n + 1))}
                  aria-label="Productos siguientes"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {visibles.map((p) => {
                const agotado = p.stock === 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={agotado || pending}
                    onClick={() => agregar(p.id)}
                    className={caja.producto}
                  >
                    <span className="line-clamp-3 text-sm font-bold leading-tight">
                      {nombreVitrina(p.nombre)}
                    </span>
                    <span>
                      <span className={caja.precio}>{formatoPesos(p.precio)}</span>
                      <span className="mt-1 block text-[11px] font-semibold text-neutral-500">
                        {p.stock == null ? `Cód. ${p.codigo}` : agotado ? "Sin stock" : `Stock ${p.stock}`}
                      </span>
                    </span>
                  </button>
                );
              })}
              {visibles.length === 0 && (
                <p className="col-span-full text-sm">No hay productos en esta sección.</p>
              )}
            </div>
            </div>
            {retiroAbierto && (
              <div className="shrink-0 border-t border-neutral-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-black">Retiro de caja</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
                  <input
                    value={conceptoRetiro}
                    onChange={(e) => setConceptoRetiro(e.target.value)}
                    placeholder="Concepto, por ejemplo proveedor o vuelto"
                    className={caja.campo}
                  />
                  <input
                    inputMode="numeric"
                    value={textoMonto(montoRetiro)}
                    onChange={(e) => setMontoRetiro(digitosMonto(e.target.value))}
                    placeholder="$0"
                    className={caja.campo}
                  />
                  <button type="button" disabled={pending} className={caja.primario} onClick={guardarRetiro}>
                    Registrar
                  </button>
                </div>
                <ul className="mt-2 max-h-24 space-y-1 overflow-auto text-xs">
                  {retiros.filter((retiro) => diaArgentina(new Date(retiro.creadoEn)) === diaArgentina()).length === 0 && (
                    <li className="text-neutral-600">Hoy no hay retiros.</li>
                  )}
                  {retiros
                    .filter((retiro) => diaArgentina(new Date(retiro.creadoEn)) === diaArgentina())
                    .map((retiro) => (
                    <li key={retiro.id}>
                      {fechaHoraVenta(retiro.creadoEn).hora} · {retiro.concepto} · {formatoPesos(retiro.monto)} · {retiro.empleado}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <form
              className="flex shrink-0 items-end gap-2 border-t border-neutral-200 bg-white p-3"
              onSubmit={(e) => {
                e.preventDefault();
                buscarCodigo(codigo);
              }}
            >
              <label className="min-w-0 flex-1 text-sm font-bold">
                Escanear
                <input
                  ref={codigoRef}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Código de barras, código o nombre"
                  className={`${caja.campo} mt-1`}
                />
              </label>
              <button type="submit" className={caja.primario}>
                ➕ Agregar
              </button>
              <button type="button" className={caja.boton} onClick={() => setBuscarProductos(true)}>
                🔍 Buscar F6
              </button>
              <button type="button" className={caja.boton} onClick={alternarEnvio}>
                {llevaEnvio ? "🚫 Quitar envío" : "🚚 Envío"}
              </button>
              <button
                type="button"
                className={caja.boton}
                onClick={() => setRetiroAbierto((abierto) => !abierto)}
              >
                💵 Retiro
              </button>
              <button
                type="button"
                className={`${caja.boton} border-cape/30 text-cape`}
                onClick={() => setUltimasAbiertas(true)}
              >
                ↩️ Devolución
              </button>
            </form>
          </section>

          <aside className="flex min-h-0 flex-col border-l border-neutral-200 bg-white">
            <div className="shrink-0 border-b border-neutral-100 bg-movipack-deep px-4 py-3 text-right text-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-confetti">Venta actual</p>
              <p className="font-display text-5xl font-bold leading-none">
                {formatoPesos(total)}
              </p>
              <p className="text-sm text-white/70">{unidades} artículos</p>
            </div>
            <div className={`${GRILLA_TICKET} border-b border-neutral-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500`}>
              <span>Detalle de venta</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Total</span>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {lineas.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-neutral-600">
                  Tocá un producto para armar la venta.
                </li>
              )}
              {lineas.map((l) => {
                if (l.id === ID_LINEA_ENVIO) {
                  return (
                    <li
                      key={l.id}
                      className={`${GRILLA_TICKET} border-b border-neutral-100 px-3 py-2 text-sm`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold">{etiquetaCostoEnvio(precioDeLinea(l, precioEnvio))}</p>
                        <p className="text-[11px] text-neutral-500">Cód. ENVIO</p>
                      </div>
                      <PrecioTicket
                        valor={precioDeLinea(l, precioEnvio)}
                        bloqueado={Boolean(pedidoWebId)}
                        onChange={(valor) => fijarPrecio(l.id, valor)}
                      />
                      <span className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          className="h-7 w-7 rounded-lg border border-neutral-200 font-bold hover:border-movipack hover:text-movipack"
                          onClick={() => setLineas((prev) => prev.filter((item) => item.id !== ID_LINEA_ENVIO))}
                        >
                          −
                        </button>
                        <span className="w-5 text-center font-bold">1</span>
                      </span>
                      <span className="text-right font-bold">{formatoPesos(precioDeLinea(l, precioEnvio))}</span>
                    </li>
                  );
                }
                const p = porId.get(l.id);
                if (!p) return null;
                return (
                  <li
                    key={l.id}
                    className={`${GRILLA_TICKET} border-b border-neutral-100 px-3 py-2 text-sm`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold">{nombreVitrina(p.nombre)}</p>
                      <p className="text-[11px] text-neutral-500">Cód. {p.codigo}</p>
                    </div>
                    <PrecioTicket
                      valor={precioDeLinea(l, precioEnvio)}
                      bloqueado={Boolean(pedidoWebId)}
                      onChange={(valor) => fijarPrecio(l.id, valor)}
                    />
                    <span className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        className="h-7 w-7 rounded-lg border border-neutral-200 font-bold hover:border-movipack hover:text-movipack"
                        onClick={() => setCantidad(l.id, l.cantidad - 1)}
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-bold">{l.cantidad}</span>
                      <button
                        type="button"
                        className="h-7 w-7 rounded-lg border border-neutral-200 font-bold hover:border-movipack hover:text-movipack"
                        onClick={() => setCantidad(l.id, l.cantidad + 1)}
                      >
                        +
                      </button>
                    </span>
                    <span className="text-right font-bold">
                      {formatoPesos(precioDeLinea(l, precioEnvio) * l.cantidad)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="shrink-0 px-4 pt-3 text-sm font-semibold text-neutral-600">
              Cliente: <span className="text-foreground">{clienteVenta ? nombreVisible(clienteVenta) : cliente}</span>
              {descuentoVenta > 0 ? ` · descuento ${descuentoVenta}%` : ""}
            </p>

            <div className="m-3 shrink-0 space-y-2 rounded-2xl bg-confetti/20 px-3 py-3 text-center">
              <p className={caja.kicker}>Última venta</p>
              <p className="mt-1 font-display text-3xl font-bold text-movipack">
                {ultima ? formatoPesos(ultima.total) : formatoPesos(0)}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {ultima ? etiquetaFormaPago(ultima.formaPago) : "Contado"}
              </p>
              {ultima && (
                <p className="text-xs text-neutral-600">
                  Factura {ultima.numero} · {ultima.cliente}
                </p>
              )}
              <button
                type="button"
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cape text-sm font-bold text-white shadow-md shadow-cape/25 transition hover:brightness-110"
                onClick={() => setUltimasAbiertas(true)}
              >
                ↩️ Devolución / reimprimir
              </button>
            </div>

            <div className="grid shrink-0 gap-2 p-3 pt-0">
              {clienteVenta && lineas.length > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  className={`${caja.boton} h-12 border-movipack/40 text-movipack`}
                  onClick={generarPresupuesto}
                >
                  📄 Presupuesto PDF
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={caja.boton}
                  onClick={() => {
                    setLineas([]);
                    soltarPedidoWeb();
                    setMensaje(null);
                  }}
                >
                  🗑️ Borrar
                </button>
                <button
                  type="button"
                  disabled={pending || lineas.length === 0}
                  className={caja.oscuro}
                  onClick={terminarVenta}
                >
                  ✅ Terminar venta F9
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {ultimasAbiertas && (
        <CajaUltimasVentas
          ventas={historial.length > 0 ? historial : ventas}
          onCerrar={() => setUltimasAbiertas(false)}
          onHecho={(r) => {
            setMensaje(r);
            if (r.ok) {
              router.refresh();
            }
          }}
        />
      )}

      {vista === "venta" && buscarProductos && (
        <BuscarProductoVenta
          productos={productos}
          rubros={rubros}
          etiqueta={etiqueta}
          onElegir={agregar}
          onCerrar={() => setBuscarProductos(false)}
        />
      )}

      {(vista === "cierre" || vista === "listados" || vista === "stock" || vista === "clientes" || vista === "productos" || vista === "mantenimiento" || vista === "deudas") && (
        <div className="min-h-0 flex-1 overflow-auto">
      {vista === "cierre" && (
        <CajaCierre
          total={total}
          articulos={unidades}
          lineas={detalleActual()}
          personas={personas}
          clienteInicial={cliente}
          clienteFicha={clienteVenta}
          pedidoWeb={pedidoWeb}
          pending={pending}
          comprobante={comprobante}
          medios={mediosPago}
          ventas={ventasOk.slice(0, 12).map((v) => ({
            id: v.id,
            numero: v.numero,
            creadoEn: v.creadoEn,
            cliente: v.cliente,
            formaPago: v.formaPago,
            total: v.total,
            lineas: v.lineas.map((l) => ({ nombre: l.nombre, cantidad: l.cantidad, precio: l.precio })),
          }))}
          onVolver={() => setVista("venta")}
          onCliente={(persona) => {
            setClienteVenta(persona);
            setCliente(persona ? nombreVisible(persona) : "Cliente genérico");
          }}
          onCobrar={cerrarCobrando}
          onDeuda={cerrarEnDeuda}
          onNueva={() => abrirVenta(true)}
        />
      )}

      {vista === "listados" && (
        <CajaListados
          productos={productos}
          ventas={historial}
          deudas={deudas}
          comprobantes={comprobantes.map((c) => ({
            numero: c.numero,
            fecha: c.fecha,
            proveedorNombre: c.proveedorNombre,
            origen: c.origen,
            articulos: c.lineas.length,
            total: c.total,
          }))}
          retiros={retiros.map((r) => ({
            creadoEn: r.creadoEn,
            empleado: r.empleado,
            concepto: r.concepto,
            monto: r.monto,
          }))}
          etiqueta={etiqueta}
          pending={pending}
          onVolver={() => setVista("inicio")}
          onAnular={(id) => {
            const data = new FormData();
            data.set("id", id);
            start(async () => {
              const r = await anularVenta(data);
              setMensaje(r);
              if (r?.ok) router.refresh();
            });
          }}
        />
      )}

      {vista === "stock" && (
        <CajaDeposito
          modo="stock"
          productos={productos}
          proveedores={proveedores}
          pedidos={pedidosProveedor}
          regularizaciones={regularizaciones}
          entradas={entradas}
          personas={personas}
          esAdmin={esAdmin}
          etiqueta={etiqueta}
          compras={compras}
          deudas={deudas}
          fichaProductos={fichaProductos}
          fichaRubros={fichaRubros}
          descuentoClienteGenerico={descuentoClienteGenerico}
          tasasCuota={tasasCuota}
          moraCredito={moraCredito}
          moraCuenta={moraCuenta}
          plazoCuenta={plazoCuenta}
          envio={envio}
          ajustePorSeccion={ajustePorSeccion}
          mediosPago={mediosPago}
          onSalir={() => setVista("inicio")}
        />
      )}

      {(vista === "clientes" || vista === "productos") && (
        <CajaDeposito
          modo={vista}
          productos={productos}
          proveedores={proveedores}
          pedidos={pedidosProveedor}
          regularizaciones={regularizaciones}
          entradas={entradas}
          personas={personas}
          esAdmin={esAdmin}
          etiqueta={etiqueta}
          compras={compras}
          deudas={deudas}
          fichaProductos={fichaProductos}
          fichaRubros={fichaRubros}
          descuentoClienteGenerico={descuentoClienteGenerico}
          tasasCuota={tasasCuota}
          moraCredito={moraCredito}
          moraCuenta={moraCuenta}
          plazoCuenta={plazoCuenta}
          envio={envio}
          ajustePorSeccion={ajustePorSeccion}
          mediosPago={mediosPago}
          onSalir={() => setVista("inicio")}
        />
      )}

      {vista === "mantenimiento" && (
        <CajaDeposito
          modo="mantenimiento"
          productos={productos}
          proveedores={proveedores}
          pedidos={pedidosProveedor}
          regularizaciones={regularizaciones}
          entradas={entradas}
          personas={personas}
          esAdmin={esAdmin}
          etiqueta={etiqueta}
          compras={compras}
          deudas={deudas}
          fichaProductos={fichaProductos}
          fichaRubros={fichaRubros}
          descuentoClienteGenerico={descuentoClienteGenerico}
          tasasCuota={tasasCuota}
          moraCredito={moraCredito}
          moraCuenta={moraCuenta}
          plazoCuenta={plazoCuenta}
          envio={envio}
          ajustePorSeccion={ajustePorSeccion}
          mediosPago={mediosPago}
          onSalir={() => setVista("inicio")}
        />
      )}

      {vista === "deudas" && (
        <section className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
            <div>
              <h2 className="font-display text-2xl font-bold leading-none">Deudas</h2>
              <p className="mt-1 text-xs font-semibold text-neutral-500">
                Verde al día · amarillo primer recargo · rojo en mora
              </p>
            </div>
            <button type="button" className={caja.boton} onClick={() => setVista("inicio")}>
              Menú
            </button>
          </div>
          <div ref={panelDeudas} className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {deudaAbierta && fichas.find((f) => f.cliente.id === deudaAbierta) ? (
              <AdminClienteActividad
                resumen={fichas.find((f) => f.cliente.id === deudaAbierta)!}
                moraCredito={moraCredito}
                moraCuenta={moraCuenta}
                onVolver={() => setDeudaAbierta(null)}
              />
            ) : (
              <AdminCuentasLista
                resumenes={fichas}
                novedades={novedades}
                solicitudes={solicitudes}
                onAbrir={setDeudaAbierta}
                compacto
              />
            )}
          </div>
        </section>
      )}
        </div>
      )}
    </div>
  );
}

function PrecioTicket({
  valor,
  bloqueado,
  onChange,
}: {
  valor: number;
  bloqueado: boolean;
  onChange: (valor: string) => void;
}) {
  if (bloqueado) {
    return <span className="text-right font-semibold">{formatoPesos(valor)}</span>;
  }
  return (
    <input
      inputMode="numeric"
      aria-label="Precio"
      value={textoMonto(valor)}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-neutral-200 px-1 py-1 text-right text-sm font-semibold outline-none focus:border-movipack"
    />
  );
}

function BuscarProductoVenta({
  productos,
  rubros,
  etiqueta,
  onElegir,
  onCerrar,
}: {
  productos: ProductoCaja[];
  rubros: { clave: string; etiqueta: string }[];
  etiqueta: Record<string, string>;
  onElegir: (id: string) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [barras, setBarras] = useState("");
  const [seccion, setSeccion] = useState("");
  const qNombre = nombre.trim().toLowerCase();
  const qCodigo = codigo.trim().toLowerCase();
  const qBarras = barras.trim().toLowerCase();
  const hayFiltro = Boolean(qNombre || qCodigo || qBarras || seccion);
  const lista = useMemo(() => {
    if (!hayFiltro) return [];
    return productos
      .filter((p) => p.mostrarEnCaja)
      .filter((p) => !seccion || p.seccion === seccion)
      .filter(
        (p) =>
          !qNombre ||
          nombreVitrina(p.nombre).toLowerCase().includes(qNombre) ||
          p.nombre.toLowerCase().includes(qNombre),
      )
      .filter((p) => !qCodigo || p.codigo.toLowerCase().includes(qCodigo))
      .filter(
        (p) =>
          !qBarras ||
          (p.codigosBarra ?? []).some((c) => c.toLowerCase().includes(qBarras)),
      )
      .slice(0, 60);
  }, [productos, hayFiltro, seccion, qNombre, qCodigo, qBarras]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
      <div className={`${caja.popup} max-h-[88dvh] max-w-3xl overflow-hidden`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={caja.kicker}>F6 · tiempo real</p>
            <h2 className="font-display text-2xl font-bold">Buscar producto</h2>
          </div>
          <button type="button" className={caja.boton} onClick={onCerrar}>
            Salir
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Código
            <input
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej. 95"
              className={`${caja.campo} mt-1`}
            />
          </label>
          <label className="text-sm font-bold">
            Código de barras
            <input
              value={barras}
              onChange={(e) => setBarras(e.target.value)}
              placeholder="EAN / barras"
              className={`${caja.campo} mt-1`}
            />
          </label>
          <label className="text-sm font-bold">
            Nombre
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Escribí y se filtra al instante"
              className={`${caja.campo} mt-1`}
            />
          </label>
          <label className="text-sm font-bold">
            Sección
            <select
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              className={`${caja.campo} mt-1`}
            >
              <option value="">Todas</option>
              {rubros.map((r) => (
                <option key={r.clave} value={r.clave}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs font-semibold text-neutral-500">
          {hayFiltro ? `${lista.length} resultado${lista.length === 1 ? "" : "s"}` : "Completá al menos un campo"}
        </p>
        <div className="mt-2 max-h-[48dvh] overflow-y-auto rounded-xl border border-neutral-200 bg-white">
          {!hayFiltro && (
            <p className="px-3 py-6 text-center text-sm text-neutral-600">
              Escribí código, barras, nombre o elegí una sección. La lista se actualiza sola.
            </p>
          )}
          {hayFiltro && lista.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-neutral-600">No hay productos con ese filtro.</p>
          )}
          {lista.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${caja.fila} grid w-full grid-cols-[5rem_1fr_auto] items-center gap-2 px-3 py-2.5 text-left text-sm`}
              onClick={() => onElegir(p.id)}
            >
              <span className="font-bold">{p.codigo}</span>
              <span className="min-w-0 truncate">
                {nombreVitrina(p.nombre)}
                <span className="block text-xs text-neutral-500">
                  {etiqueta[p.seccion] ?? p.seccion}
                  {(p.codigosBarra?.length ?? 0) > 0
                    ? ` · ${p.codigosBarra![0]}`
                    : ""}
                </span>
              </span>
              <span className="font-display font-bold text-movipack">{formatoPesos(p.precio)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ElegirEmpleado({
  empleados,
  elegidoId,
  onElegir,
  onConfirmar,
  onCancelar,
}: {
  empleados: PersonaCaja[];
  elegidoId: string;
  onElegir: (persona: PersonaCaja) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <p className={caja.kicker}>Antes de vender</p>
      <h2 className="mt-1 font-display text-3xl font-bold">¿Quién usa la caja?</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Confirmá el empleado que está en el TPV. La venta queda a su nombre.
      </p>
      <div className="mt-5 grid gap-2">
        {empleados.length === 0 && (
          <p className={caja.panel + " p-4 text-sm"}>No hay empleados cargados en la caja.</p>
        )}
        {empleados.map((persona) => {
          const activo = persona.id === elegidoId;
          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => onElegir(persona)}
              className={`${caja.botonAlto} ${activo ? "!border-movipack !bg-movipack !text-white hover:!text-white" : ""}`}
            >
              <span>
                {nombreVisible(persona)}
                <span className={`mt-0.5 block text-xs font-semibold ${activo ? "text-white/80" : "text-neutral-500"}`}>
                  {persona.rol === "admin" ? "Administración" : "Caja"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancelar} className={caja.boton}>
          Cancelar
        </button>
        <button type="button" disabled={!elegidoId} onClick={onConfirmar} className={caja.primario}>
          Confirmar
        </button>
      </div>
    </section>
  );
}

function MenuCaja({
  esAdmin,
  permisos,
  onVenta,
  onListados,
  onStock,
  onClientes,
  onProductos,
  onMantenimiento,
  onDeudas,
}: {
  esAdmin: boolean;
  permisos: PermisoCaja[];
  onVenta: () => void;
  onListados: () => void;
  onStock: () => void;
  onClientes: () => void;
  onProductos: () => void;
  onMantenimiento: () => void;
  onDeudas: () => void;
}) {
  const puede = (permiso: PermisoCaja) => permisos.includes(permiso);
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-6 px-4 py-8 lg:grid-cols-[280px_1fr]">
      <div className="hero-glow flex flex-col items-center justify-center overflow-hidden rounded-3xl px-5 py-10 text-center text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-confetti">Minimarket</p>
        <p className="mt-2 font-display text-4xl font-bold italic leading-none">La Triple L</p>
        <p className="mt-3 text-sm text-white/80">Caja · Garay 1005</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {puede("venta") && <TarjetaAccion icono={<IconoVenta />} titulo="Caja / Ventas" detalle="Cobrar en el local" onClick={onVenta} />}
        {puede("listados") && <TarjetaAccion icono={<IconoListado />} titulo="Listados" detalle="Ventas, stock y clientes" onClick={onListados} />}
        {puede("stock") && <TarjetaAccion icono={<IconoStock />} titulo="Stock" detalle="Pedidos, entrada e inventario" onClick={onStock} />}
        {puede("clientes") && <TarjetaAccion icono={<IconoCliente />} titulo="Clientes" detalle="Fichas y altas" onClick={onClientes} />}
        {puede("productos") && <TarjetaAccion icono={<IconoProducto />} titulo="Productos" detalle="Cargar y modificar" onClick={onProductos} />}
        {puede("mantenimiento") && <TarjetaAccion icono={<IconoMantenimiento />} titulo="Mantenimiento" detalle="Datos del local y tasas" onClick={onMantenimiento} />}
        {puede("deudas") && <TarjetaAccion icono={<IconoDeuda />} titulo="Deudas" detalle="Cuentas corrientes" onClick={onDeudas} />}
        {esAdmin && <TarjetaAccion icono={<IconoAdmin />} titulo="Admin" detalle="Volver al menú de administración" href="/admin/pedidos" />}
      </div>
    </div>
  );
}
