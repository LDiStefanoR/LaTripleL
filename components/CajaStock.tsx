"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { EstadoDeposito } from "@/app/acciones/deposito";
import { AltaProductoRapido } from "@/components/AltaProductoRapido";
import { caja } from "@/components/caja-estilo";
import {
  IconoEntrada,
  IconoInventario,
  IconoPedido,
  IconoRegularizar,
  TarjetaAccion,
} from "@/components/CajaIconos";
import type { ProductoCaja } from "@/components/CajaPanel";
import { digitosMonto, formatoPesos, nombreVitrina, textoMonto } from "@/lib/format";
import { sugerirPrecio } from "@/lib/margen";
import { diaArgentina } from "@/lib/venta-texto";
import type { EntradaStock, PedidoProveedor, Proveedor } from "@/lib/deposito";

export function MenuStock({
  onPedido,
  onEntrada,
  onRegularizar,
  onInventario,
  onSalir,
}: {
  onPedido: () => void;
  onEntrada: () => void;
  onRegularizar: () => void;
  onInventario: () => void;
  onSalir: () => void;
}) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <p className={caja.kicker}>Depósito</p>
      <h2 className={caja.titulo}>Stock</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <TarjetaAccion icono={<IconoPedido />} titulo="Pedido al proveedor" detalle="Armar y exportar el pedido" onClick={onPedido} />
        <TarjetaAccion icono={<IconoEntrada />} titulo="Entrada de stock" detalle="Sumar mercadería y actualizar el costo" onClick={onEntrada} />
        <TarjetaAccion icono={<IconoRegularizar />} titulo="Regularizar stock" detalle="Corregir o descontar lo contado" onClick={onRegularizar} />
        <TarjetaAccion icono={<IconoInventario />} titulo="Inventario" detalle="Ver, filtrar y editar productos" onClick={onInventario} />
      </div>
      <button type="button" className={`${caja.boton} mt-8`} onClick={onSalir}>
        Salir
      </button>
    </section>
  );
}

function buscarTexto(valor: string) {
  return valor.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function recibidoLinea(linea: { recibido?: number; cantidad: number }, estado: string) {
  if (typeof linea.recibido === "number") return Math.max(0, Math.round(linea.recibido));
  return estado === "recibido" ? linea.cantidad : 0;
}

function etiquetaPedido(estado: PedidoProveedor["estado"]) {
  if (estado === "recibido") return "Recibido";
  if (estado === "parcial") return "Recepción parcial";
  return "Pendiente";
}

export function PedidoProveedorPanel({
  productos,
  proveedores,
  pedidos,
  etiqueta,
  rubros,
  pending,
  aviso,
  onVolver,
  onGenerar,
  onActualizar,
  onRecepcion,
  onQuitar,
  onAviso,
}: {
  productos: ProductoCaja[];
  proveedores: Proveedor[];
  pedidos: PedidoProveedor[];
  etiqueta: Record<string, string>;
  rubros: { clave: string; etiqueta: string }[];
  pending: boolean;
  aviso: ReactNode;
  onVolver: () => void;
  onGenerar: (data: FormData) => Promise<EstadoDeposito>;
  onActualizar: (data: FormData) => Promise<EstadoDeposito>;
  onRecepcion: (data: FormData) => Promise<EstadoDeposito>;
  onQuitar: (id: string) => void;
  onAviso: (mensaje: string) => void;
}) {
  const [vista, setVista] = useState<"elegir" | "crear" | "lista" | "editar" | "recibir">("elegir");
  const [pedidoId, setPedidoId] = useState("");
  const [alta, setAlta] = useState(false);
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [soloBajos, setSoloBajos] = useState(false);
  const [lineas, setLineas] = useState<{ id: string; cantidad: number }[]>([]);
  const [recien, setRecien] = useState<ProductoCaja[]>([]);
  const catalogo = useMemo(() => {
    const ids = new Set(productos.map((p) => p.id));
    return [...recien.filter((p) => !ids.has(p.id)), ...productos];
  }, [productos, recien]);
  const proveedor = proveedores.find((p) => p.id === proveedorId) ?? null;
  const asignados = useMemo(
    () => catalogo.filter((p) => p.proveedorId === proveedorId),
    [catalogo, proveedorId],
  );
  const base = asignados.length > 0 ? asignados : catalogo;
  const lista = useMemo(() => {
    const t = buscarTexto(q.trim());
    return base.filter((p) => {
      if (soloBajos && !(p.stock != null && p.stockMinimo != null && p.stock <= p.stockMinimo)) return false;
      if (!t) return true;
      return (
        buscarTexto(p.nombre).includes(t) ||
        buscarTexto(p.codigo).includes(t) ||
        (p.codigosBarra ?? []).some((c) => buscarTexto(c).includes(t))
      );
    });
  }, [base, q, soloBajos]);

  const pedidoActivo = pedidos.find((p) => p.id === pedidoId) ?? null;

  function minimoPedido(id: string) {
    if (vista !== "editar" || !pedidoActivo) return 0;
    const linea = pedidoActivo.lineas.find((l) => l.productoId === id);
    return linea ? recibidoLinea(linea, pedidoActivo.estado) : 0;
  }

  function poner(id: string, cantidad: number) {
    const minimo = minimoPedido(id);
    setLineas((prev) => {
      const siguiente = Math.max(minimo, cantidad);
      if (siguiente < 1) return prev.filter((l) => l.id !== id);
      const ya = prev.find((l) => l.id === id);
      if (ya) return prev.map((l) => (l.id === id ? { ...l, cantidad: siguiente } : l));
      return [...prev, { id, cantidad: siguiente }];
    });
  }

  function abrirEdicion(id: string) {
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return;
    setPedidoId(id);
    setProveedorId(pedido.proveedorId);
    setLineas(pedido.lineas.map((l) => ({ id: l.productoId, cantidad: l.cantidad })));
    setQ("");
    setVista("editar");
  }

  function pedirFaltantes() {
    for (const producto of base) {
      if (producto.stock == null || producto.stockMinimo == null) continue;
      const falta = producto.stockMinimo - producto.stock;
      if (falta > 0) poner(producto.id, falta);
    }
  }

  const titulo =
    vista === "crear"
      ? "Crear un pedido"
      : vista === "editar"
        ? `Modificar pedido ${pedidoActivo?.numero ?? ""}`
        : vista === "lista"
          ? "Pedidos hechos"
          : vista === "recibir"
            ? `Recepcionar pedido ${pedidoActivo?.numero ?? ""}`
            : "Pedido al proveedor";
  const volver = () => {
    if (vista === "elegir") onVolver();
    else if (vista === "editar" || vista === "recibir") setVista("lista");
    else {
      setLineas([]);
      setVista("elegir");
    }
  };

  return (
    <section className="px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={caja.kicker}>Compras</p>
          <h2 className={caja.titulo}>{titulo}</h2>
        </div>
        <button type="button" className={caja.boton} onClick={volver}>
          Volver
        </button>
      </div>
      {vista === "elegir" && (
        <>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Creá un pedido nuevo o entrá a los que ya están hechos. El detalle de cada pedido se abre solo cuando lo modificás o lo recepcionás.
          </p>
          <div className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
            <TarjetaAccion
              icono={<span className="text-3xl leading-none">📝</span>}
              titulo="Crear un pedido"
              detalle="Elegí el proveedor y las cantidades"
              onClick={() => {
                setLineas([]);
                setPedidoId("");
                setVista("crear");
              }}
            />
            <TarjetaAccion
              icono={<span className="text-3xl leading-none">📦</span>}
              titulo="Pedidos hechos"
              detalle="Modificar, borrar o recepcionar"
              onClick={() => setVista("lista")}
            />
          </div>
        </>
      )}
      {vista !== "elegir" && (
        <p className="mt-3 max-w-3xl text-sm text-neutral-600">
          {vista === "lista"
            ? "Cada pedido queda cerrado. Abrilo solo para modificarlo, borrarlo o recepcionar la mercadería que entró."
            : vista === "recibir"
              ? "Cargá la factura, marcá lo que llegó con el costo de esa factura y sumá el producto que el proveedor mandó de más. Al guardar, la lista queda lista para reenviar."
              : "Elegí el proveedor y las cantidades. El PDF sale listo para mandar, sin tu stock."}
        </p>
      )}
      <div className="mt-3">{aviso}</div>
      {alta && vista !== "recibir" && (
        <AltaProductoRapido
          rubros={rubros}
          proveedores={proveedores}
          proveedorId={proveedorId}
          onCerrar={() => setAlta(false)}
          onListo={(mensaje, producto) => {
            onAviso(mensaje);
            if (!producto) return;
            setRecien((prev) =>
              prev.some((p) => p.id === producto.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: producto.id,
                      codigo: producto.codigo,
                      nombre: producto.nombre,
                      seccion: "",
                      precio: producto.precio,
                      stock: null,
                      stockMinimo: null,
                      costo: producto.costo,
                      margen: producto.margen,
                      proveedorId,
                      mostrarEnCaja: true,
                    },
                  ],
            );
            poner(producto.id, 1);
          }}
        />
      )}
      {vista === "lista" && (
        <PedidosGuardados
          pedidos={pedidos}
          pending={pending}
          onEditar={abrirEdicion}
          onRecibir={(id) => {
            setPedidoId(id);
            setVista("recibir");
          }}
          onQuitar={onQuitar}
        />
      )}
      {vista === "recibir" && pedidoActivo && (
        <RecepcionPedido
          pedido={pedidoActivo}
          productos={catalogo}
          proveedores={proveedores}
          rubros={rubros}
          pending={pending}
          onAviso={onAviso}
          onRecepcion={async (data) => {
            const resultado = await onRecepcion(data);
            if (resultado?.ok) setVista("lista");
          }}
        />
      )}
      {(vista === "crear" || vista === "editar") && (
        <>
      {asignados.length === 0 && proveedor && (
        <p className={`${caja.nota} mt-3`}>
          Ningún producto tiene a {proveedor.nombre} como proveedor. Se muestran todos. Asignalo desde Inventario o desde la ficha del producto.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={caja.boton} onClick={() => setAlta(true)}>
          Cargar producto
        </button>
      </div>
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_22rem]">
        <div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-52 text-sm font-bold">
              Proveedor
              <select
                value={proveedorId}
                onChange={(e) => {
                  setProveedorId(e.target.value);
                  setLineas([]);
                }}
                className={`${caja.campo} mt-1`}
              >
                {proveedores.length === 0 && <option value="">Cargá un proveedor en Mantenimiento</option>}
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-52 text-sm font-bold">
              Buscar
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o código" className={`${caja.campo} mt-1`} />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm font-bold">
              <input type="checkbox" checked={soloBajos} onChange={(e) => setSoloBajos(e.target.checked)} />
              Solo bajo el mínimo
            </label>
            <button type="button" className={caja.boton} onClick={pedirFaltantes}>
              Pedir faltantes
            </button>
          </div>
          <p className="mt-3 text-sm font-semibold text-neutral-500">{lista.length} productos</p>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="sticky top-0 bg-neutral-100 text-xs uppercase">
                <tr>
                  <th className="px-2 py-2">Código</th>
                  <th className="px-2 py-2">Producto</th>
                  <th className="px-2 py-2">Sección</th>
                  <th className="px-2 py-2 text-right">Stock</th>
                  <th className="px-2 py-2 text-right">Mínimo</th>
                  <th className="px-2 py-2 text-right">Último costo</th>
                  <th className="px-2 py-2">Pedir</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const cantidad = lineas.find((l) => l.id === p.id)?.cantidad ?? 0;
                  const bajo = p.stock != null && p.stockMinimo != null && p.stock <= p.stockMinimo;
                  return (
                    <tr key={p.id} className={`border-t border-neutral-100 ${bajo ? "bg-confetti/20" : ""}`}>
                      <td className="px-2 py-2 font-bold">{p.codigo}</td>
                      <td className="px-2 py-2">{nombreVitrina(p.nombre)}</td>
                      <td className="px-2 py-2">{etiqueta[p.seccion] ?? p.seccion}</td>
                      <td className="px-2 py-2 text-right font-bold">{p.stock == null ? "—" : p.stock}</td>
                      <td className="px-2 py-2 text-right">{p.stockMinimo == null ? "—" : p.stockMinimo}</td>
                      <td className="px-2 py-2 text-right">{p.costo == null ? "—" : formatoPesos(p.costo)}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          value={cantidad || ""}
                          placeholder="0"
                          onChange={(e) => poner(p.id, Math.max(0, Number(e.target.value) || 0))}
                          className="w-16 rounded-lg border border-neutral-300 px-2 py-1 font-bold"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lista.length === 0 && <p className="px-3 py-6 text-sm font-semibold text-neutral-500">No hay productos con ese filtro.</p>}
          </div>
        </div>
        <aside className={`${caja.panel} p-4`}>
          <p className="font-display text-xl font-bold">A pedir</p>
          <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
            {lineas.length === 0 && <li className="text-sm text-neutral-500">Todavía no elegiste productos.</li>}
            {lineas.map((linea) => {
              const producto = catalogo.find((p) => p.id === linea.id);
              if (!producto) return null;
              return (
                <li key={linea.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-bold">{producto.codigo}</span>
                    <span className="block truncate text-neutral-600">{nombreVitrina(producto.nombre)}</span>
                  </span>
                  <span className="text-right font-black">
                    {linea.cantidad}
                    {minimoPedido(linea.id) > 0 && (
                      <span className="block text-xs font-semibold text-neutral-500">Ya entraron {minimoPedido(linea.id)}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={pending || lineas.length === 0 || !proveedorId}
            className={`${caja.primario} mt-4 w-full`}
            onClick={() => {
              const data = new FormData();
              data.set("proveedorId", proveedorId);
              data.set("lineas", JSON.stringify(lineas.map((l) => ({ productoId: l.id, cantidad: l.cantidad }))));
              if (vista === "editar") data.set("id", pedidoId);
              const guardar = vista === "editar" ? onActualizar(data) : onGenerar(data);
              void guardar.then((resultado) => {
                if (resultado?.ok) {
                  setLineas([]);
                  setVista("lista");
                }
              });
            }}
          >
            {pending ? "Guardando…" : vista === "editar" ? "Guardar cambios" : "Generar pedido"}
          </button>
        </aside>
      </div>
        </>
      )}
    </section>
  );
}

function fechaPedido(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function PedidosGuardados({
  pedidos,
  pending,
  onEditar,
  onRecibir,
  onQuitar,
}: {
  pedidos: PedidoProveedor[];
  pending: boolean;
  onEditar: (id: string) => void;
  onRecibir: (id: string) => void;
  onQuitar: (id: string) => void;
}) {
  const [confirmar, setConfirmar] = useState<string | null>(null);
  return (
    <ul className="mt-4 max-w-3xl space-y-3">
      {pedidos.length === 0 && <li className="text-sm text-neutral-500">Todavía no hay pedidos.</li>}
      {pedidos.map((item) => {
        const recibido = item.lineas.some((linea) => recibidoLinea(linea, item.estado) > 0);
        const cerrado = item.estado === "recibido";
        return (
          <li key={item.id} className={`${caja.panel} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-bold">Pedido {item.numero}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {item.proveedorNombre} · {fechaPedido(item.creadoEn)} · {etiquetaPedido(item.estado)}
                  {item.factura ? ` · Factura ${item.factura}` : ""} · {item.lineas.length}{" "}
                  {item.lineas.length === 1 ? "producto" : "productos"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/caja/pedido-proveedor/${item.id}?formato=pdf`} className={caja.boton}>
                  PDF
                </a>
                <a href={`/caja/pedido-proveedor/${item.id}?formato=xlsx`} className={caja.boton}>
                  Excel
                </a>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!cerrado && (
                <button type="button" className={caja.boton} onClick={() => onEditar(item.id)}>
                  Modificar
                </button>
              )}
              {!cerrado && (
                <button type="button" className={caja.primario} onClick={() => onRecibir(item.id)}>
                  Recepcionar
                </button>
              )}
              {!recibido && confirmar !== item.id && (
                <button type="button" className="text-sm font-bold text-red-700" onClick={() => setConfirmar(item.id)}>
                  Borrar
                </button>
              )}
              {!recibido && confirmar === item.id && (
                <>
                  <button type="button" disabled={pending} className="text-sm font-bold text-red-700" onClick={() => onQuitar(item.id)}>
                    Confirmar borrado
                  </button>
                  <button type="button" className="text-sm font-bold" onClick={() => setConfirmar(null)}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type LineaRecepcion = {
  productoId: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  ya: number;
  recibido: number;
  costo: string;
  margen: string;
  precio: string;
};

function precioInicial(producto: ProductoCaja | undefined) {
  const costo = producto?.costo == null ? "" : String(producto.costo);
  const margen = producto?.margen == null ? "" : String(producto.margen);
  return {
    costo,
    margen,
    precio: String(sugerirPrecio(costo, margen) ?? producto?.precio ?? ""),
  };
}

function RecepcionPedido({
  pedido,
  productos,
  proveedores,
  rubros,
  pending,
  onAviso,
  onRecepcion,
}: {
  pedido: PedidoProveedor;
  productos: ProductoCaja[];
  proveedores: Proveedor[];
  rubros: { clave: string; etiqueta: string }[];
  pending: boolean;
  onAviso: (mensaje: string) => void;
  onRecepcion: (data: FormData) => void;
}) {
  const [lineas, setLineas] = useState<LineaRecepcion[]>(() =>
    pedido.lineas.map((linea) => {
      const producto = productos.find((p) => p.id === linea.productoId);
      const ya = recibidoLinea(linea, pedido.estado);
      const precio = precioInicial(producto);
      return {
        productoId: linea.productoId,
        codigo: linea.codigo,
        nombre: linea.nombre,
        cantidad: linea.cantidad,
        ya,
        recibido: ya,
        ...precio,
      };
    }),
  );
  const [factura, setFactura] = useState(pedido.factura ?? "");
  const [fecha, setFecha] = useState(diaArgentina());
  const [busqueda, setBusqueda] = useState("");
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState("");
  const sugeridos = useMemo(() => {
    const t = buscarTexto(busqueda.trim());
    if (t.length < 2) return [];
    const ids = new Set(lineas.map((l) => l.productoId));
    return productos
      .filter(
        (p) =>
          !ids.has(p.id) &&
          (buscarTexto(p.nombre).includes(t) ||
            buscarTexto(p.codigo).includes(t) ||
            (p.codigosBarra ?? []).some((c) => buscarTexto(c).includes(t))),
      )
      .slice(0, 8);
  }, [busqueda, lineas, productos]);

  function cambiar(id: string, patch: Partial<LineaRecepcion>) {
    setLineas((prev) => prev.map((l) => (l.productoId === id ? { ...l, ...patch } : l)));
  }

  function cambiarPrecio(id: string, campo: "costo" | "margen" | "precio", valor: string) {
    setLineas((prev) =>
      prev.map((linea) => {
        if (linea.productoId !== id) return linea;
        const limpio = campo === "margen" ? valor : digitosMonto(valor);
        const siguiente = { ...linea, [campo]: limpio };
        if (campo !== "precio") {
          const sugerido = sugerirPrecio(siguiente.costo, siguiente.margen);
          if (sugerido != null) siguiente.precio = String(sugerido);
        }
        return siguiente;
      }),
    );
  }

  function agregar(producto: ProductoCaja) {
    if (lineas.some((l) => l.productoId === producto.id)) return;
    const precio = precioInicial(producto);
    setLineas((prev) => [
      ...prev,
      {
        productoId: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad: 1,
        ya: 0,
        recibido: 1,
        ...precio,
      },
    ]);
    setBusqueda("");
  }

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-neutral-600">
        {pedido.proveedorNombre} · {etiquetaPedido(pedido.estado)}. El stock cambia solo con las unidades nuevas. El PDF y el Excel salen con la lista guardada.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`/caja/pedido-proveedor/${pedido.id}?formato=pdf`} className={caja.boton}>
          PDF para el proveedor
        </a>
        <a href={`/caja/pedido-proveedor/${pedido.id}?formato=xlsx`} className={caja.boton}>
          Excel
        </a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Número de factura
          <input value={factura} onChange={(e) => setFactura(e.target.value)} className={`${caja.campo} mt-1`} placeholder="Ej. 0001-00001234" />
        </label>
        <label className="text-sm font-bold">
          Fecha del comprobante
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${caja.campo} mt-1`} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-64 flex-1 text-sm font-bold">
          Agregar un producto que llegó
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, código o barra"
            className={`${caja.campo} mt-1`}
          />
        </label>
        <button type="button" className={caja.boton} onClick={() => setAlta(true)}>
          Cargar producto y sumarlo
        </button>
      </div>
      {sugeridos.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-xl border border-neutral-200">
          {sugeridos.map((producto) => (
            <li key={producto.id}>
              <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-movipack/5" onClick={() => agregar(producto)}>
                <span>
                  {producto.codigo} · {nombreVitrina(producto.nombre)}
                </span>
                <span className="font-bold">Sumar</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {alta && (
        <AltaProductoRapido
          rubros={rubros}
          proveedores={proveedores}
          proveedorId={pedido.proveedorId}
          onCerrar={() => setAlta(false)}
          onListo={(mensaje, producto) => {
            onAviso(mensaje);
            if (!producto) return;
            agregar({
              id: producto.id,
              codigo: producto.codigo,
              nombre: producto.nombre,
              seccion: "",
              precio: producto.precio,
              stock: null,
              stockMinimo: null,
              costo: producto.costo,
              margen: producto.margen,
              proveedorId: pedido.proveedorId,
              mostrarEnCaja: true,
            });
          }}
        />
      )}
      <ul className="mt-3 divide-y divide-neutral-100">
        {lineas.map((linea) => {
          const producto = productos.find((p) => p.id === linea.productoId);
          const entraAhora = linea.recibido > linea.ya;
          return (
            <li key={linea.productoId} className="py-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 font-bold">
                  <span className="block">{linea.codigo}</span>
                  <span className="block font-semibold text-neutral-600">{nombreVitrina(linea.nombre)}</span>
                </span>
                <label className="text-xs font-bold text-neutral-600">
                  Pedido
                  <input
                    type="number"
                    min={linea.ya}
                    value={linea.cantidad}
                    onChange={(e) => {
                      const cantidad = Math.max(linea.ya, Number(e.target.value) || 0);
                      cambiar(linea.productoId, {
                        cantidad,
                        recibido: Math.min(linea.recibido, cantidad),
                      });
                    }}
                    className="ml-2 w-16 rounded-lg border border-neutral-300 px-2 py-1 text-sm font-bold"
                  />
                </label>
                {linea.ya > 0 && <span className="text-neutral-500">Ya entraron {linea.ya}</span>}
                <label className="text-xs font-bold text-neutral-600">
                  Entró
                  <input
                    type="number"
                    min={linea.ya}
                    max={linea.cantidad}
                    value={linea.recibido}
                    onChange={(e) =>
                      cambiar(linea.productoId, {
                        recibido: Math.max(linea.ya, Math.min(linea.cantidad, Number(e.target.value) || 0)),
                      })
                    }
                    className="ml-2 w-16 rounded-lg border border-neutral-300 px-2 py-1 text-sm font-bold"
                  />
                </label>
                {linea.ya === 0 && (
                  <button type="button" className="text-xs font-bold text-red-700" onClick={() => setLineas((prev) => prev.filter((l) => l.productoId !== linea.productoId))}>
                    Quitar
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-neutral-600">
                Último costo: {producto?.costo == null ? "sin costo cargado" : formatoPesos(producto.costo)}. Precio actual:{" "}
                {producto ? formatoPesos(producto.precio) : formatoPesos(Number(linea.precio) || 0)}.
              </p>
              {entraAhora && (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <label className="text-xs font-bold text-neutral-600">
                    Costo de factura
                    <input value={textoMonto(linea.costo)} onChange={(e) => cambiarPrecio(linea.productoId, "costo", e.target.value)} inputMode="numeric" className={`${caja.campo} mt-1`} />
                  </label>
                  <label className="text-xs font-bold text-neutral-600">
                    Margen %
                    <input value={linea.margen} onChange={(e) => cambiarPrecio(linea.productoId, "margen", e.target.value)} inputMode="decimal" className={`${caja.campo} mt-1`} />
                  </label>
                  <label className="text-xs font-bold text-neutral-600">
                    Precio de venta
                    <input value={textoMonto(linea.precio)} onChange={(e) => cambiarPrecio(linea.productoId, "precio", e.target.value)} inputMode="numeric" className={`${caja.campo} mt-1`} />
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className={`${caja.avisoErrorPlano} mt-3`}>{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className={caja.primario}
          onClick={() => {
            const entra = lineas.some((l) => l.recibido > l.ya);
            if (entra && factura.trim().length < 1) {
              setError("Ingresá el número de factura o comprobante.");
              return;
            }
            for (const linea of lineas) {
              if (linea.recibido <= linea.ya) continue;
              if (!linea.costo.trim() || !linea.margen.trim() || !linea.precio.trim()) {
                setError(`Completá el costo de factura, el margen y el precio de ${linea.nombre}.`);
                return;
              }
            }
            setError("");
            const data = new FormData();
            data.set("id", pedido.id);
            data.set("comprobante", factura.trim());
            data.set("fecha", fecha);
            data.set(
              "lineas",
              JSON.stringify(
                lineas.map((linea) => ({
                  productoId: linea.productoId,
                  cantidad: linea.cantidad,
                  recibido: linea.recibido,
                  costo: Number(linea.costo.replace(/[^\d]/g, "")),
                  margen: Number(linea.margen.replace(",", ".")),
                  precio: Number(linea.precio.replace(/[^\d]/g, "")),
                })),
              ),
            );
            onRecepcion(data);
          }}
        >
          {pending ? "Guardando…" : "Guardar recepción"}
        </button>
        <button
          type="button"
          className={caja.boton}
          onClick={() => setLineas((prev) => prev.map((linea) => ({ ...linea, recibido: linea.cantidad })))}
        >
          Marcar todo lo pedido
        </button>
      </div>
    </div>
  );
}

export function EntradaMercaderia({
  productos,
  entradas,
  proveedores,
  rubros,
  pending,
  aviso,
  onVolver,
  onGuardar,
  onAviso,
}: {
  productos: ProductoCaja[];
  entradas: EntradaStock[];
  proveedores: Proveedor[];
  rubros: { clave: string; etiqueta: string }[];
  pending: boolean;
  aviso: ReactNode;
  onVolver: () => void;
  onGuardar: (data: FormData) => void;
  onAviso: (mensaje: string) => void;
}) {
  const [paso, setPaso] = useState<"elegir" | "cargar">("elegir");
  const [modo, setModo] = useState<"sin-pedido" | "comprobante">("sin-pedido");
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? "");
  const [factura, setFactura] = useState("");
  const [fecha, setFecha] = useState(diaArgentina());
  const [q, setQ] = useState("");
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState("");
  const [lineas, setLineas] = useState<
    { productoId: string; codigo: string; nombre: string; cantidad: string; costo: string; margen: string; precio: string }[]
  >([]);
  const sugeridos = useMemo(() => {
    const t = buscarTexto(q.trim());
    if (t.length < 2) return [];
    const ids = new Set(lineas.map((l) => l.productoId));
    return productos
      .filter(
        (p) =>
          !ids.has(p.id) &&
          (buscarTexto(p.nombre).includes(t) ||
            buscarTexto(p.codigo).includes(t) ||
            (p.codigosBarra ?? []).some((c) => buscarTexto(c).includes(t))),
      )
      .slice(0, 8);
  }, [productos, q, lineas]);

  function agregar(producto: ProductoCaja) {
    if (lineas.some((l) => l.productoId === producto.id)) return;
    const costo = producto.costo == null ? "" : String(producto.costo);
    const margen = producto.margen == null ? "" : String(producto.margen);
    setLineas((prev) => [
      ...prev,
      {
        productoId: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad: "1",
        costo,
        margen,
        precio: String(sugerirPrecio(costo, margen) ?? producto.precio),
      },
    ]);
    setQ("");
  }

  function cambiarLinea(id: string, campo: "cantidad" | "costo" | "margen" | "precio", valor: string) {
    setLineas((prev) =>
      prev.map((linea) => {
        if (linea.productoId !== id) return linea;
        const limpio = campo === "margen" || campo === "cantidad" ? valor : digitosMonto(valor);
        const siguiente = { ...linea, [campo]: limpio };
        if (campo === "costo" || campo === "margen") {
          const sugerido = sugerirPrecio(siguiente.costo, siguiente.margen);
          if (sugerido != null) siguiente.precio = String(sugerido);
        }
        return siguiente;
      }),
    );
  }

  if (paso === "elegir") {
    return (
      <section className="mx-auto max-w-5xl px-4 py-6">
        <p className={caja.kicker}>Mercadería</p>
        <h2 className={caja.titulo}>Entrada de stock</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Elegí si la mercadería llega sin un pedido armado, o si vas a cargar una factura que no salió de Pedidos al proveedor.
        </p>
        <div className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
          <TarjetaAccion
            icono={<IconoEntrada />}
            titulo="Sin pedido previo"
            detalle="Entra mercadería que no estaba pedida"
            onClick={() => {
              setModo("sin-pedido");
              setPaso("cargar");
            }}
          />
          <TarjetaAccion
            icono={<IconoPedido />}
            titulo="Comprobante nuevo"
            detalle="Factura que no se hizo desde un pedido"
            onClick={() => {
              setModo("comprobante");
              setPaso("cargar");
            }}
          />
        </div>
        <button type="button" className={`${caja.boton} mt-8`} onClick={onVolver}>
          Volver
        </button>
      </section>
    );
  }

  const titulo = modo === "sin-pedido" ? "Mercadería sin pedido" : "Comprobante sin pedido";

  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={caja.kicker}>Mercadería</p>
          <h2 className={caja.titulo}>{titulo}</h2>
        </div>
        <button type="button" className={caja.boton} onClick={() => setPaso("elegir")}>
          Volver
        </button>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-neutral-600">
        Cargá el número de factura y los artículos que actualizan el stock, con el costo que figura en el comprobante.
      </p>
      <div className="mt-3">{aviso}</div>
      {error && <p className={caja.avisoErrorPlano}>{error}</p>}
      {alta && (
        <AltaProductoRapido
          rubros={rubros}
          proveedores={proveedores}
          proveedorId={proveedorId}
          onCerrar={() => setAlta(false)}
          onListo={(mensaje, producto) => {
            onAviso(mensaje);
            if (!producto) return;
            agregar({
              id: producto.id,
              codigo: producto.codigo,
              nombre: producto.nombre,
              seccion: "",
              precio: producto.precio,
              stock: null,
              stockMinimo: null,
              costo: producto.costo,
              margen: producto.margen,
              proveedorId,
              mostrarEnCaja: true,
            });
          }}
        />
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-bold">
          Proveedor
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={`${caja.campo} mt-1`}>
            {proveedores.length === 0 && <option value="">Cargá un proveedor en Mantenimiento</option>}
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Número de factura
          <input value={factura} onChange={(e) => setFactura(e.target.value)} className={`${caja.campo} mt-1`} placeholder="Ej. 0001-00001234" />
        </label>
        <label className="text-sm font-bold">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${caja.campo} mt-1`} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-64 flex-1 text-sm font-bold">
          Artículo
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, código o barra" className={`${caja.campo} mt-1`} />
        </label>
        <button type="button" className={caja.boton} onClick={() => setAlta(true)}>
          Cargar producto y sumarlo
        </button>
      </div>
      {sugeridos.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {sugeridos.map((producto) => (
            <li key={producto.id}>
              <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-movipack/5" onClick={() => agregar(producto)}>
                <span>
                  {producto.codigo} · {nombreVitrina(producto.nombre)}
                </span>
                <span className="font-bold">Sumar</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-4 space-y-3">
        {lineas.length === 0 && <li className="text-sm text-neutral-500">Todavía no agregaste artículos.</li>}
        {lineas.map((linea) => (
          <li key={linea.productoId} className="rounded-2xl border border-neutral-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold">
                {linea.codigo} · {nombreVitrina(linea.nombre)}
              </p>
              <button type="button" className="text-xs font-bold text-red-700" onClick={() => setLineas((prev) => prev.filter((l) => l.productoId !== linea.productoId))}>
                Quitar
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <label className="text-xs font-bold text-neutral-600">
                Cantidad
                <input value={linea.cantidad} onChange={(e) => cambiarLinea(linea.productoId, "cantidad", e.target.value)} inputMode="numeric" className={`${caja.campo} mt-1`} />
              </label>
              <label className="text-xs font-bold text-neutral-600">
                Costo de factura
                <input value={textoMonto(linea.costo)} onChange={(e) => cambiarLinea(linea.productoId, "costo", e.target.value)} inputMode="numeric" className={`${caja.campo} mt-1`} />
              </label>
              <label className="text-xs font-bold text-neutral-600">
                Margen %
                <input value={linea.margen} onChange={(e) => cambiarLinea(linea.productoId, "margen", e.target.value)} inputMode="decimal" className={`${caja.campo} mt-1`} />
              </label>
              <label className="text-xs font-bold text-neutral-600">
                Precio de venta
                <input value={textoMonto(linea.precio)} onChange={(e) => cambiarLinea(linea.productoId, "precio", e.target.value)} inputMode="numeric" className={`${caja.campo} mt-1`} />
              </label>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={pending}
        className={`${caja.primario} mt-4`}
        onClick={() => {
          if (factura.trim().length < 1) {
            setError("Ingresá el número de factura o comprobante.");
            return;
          }
          if (!proveedorId) {
            setError("Elegí el proveedor.");
            return;
          }
          if (lineas.length === 0) {
            setError("Agregá los artículos que actualizan el stock.");
            return;
          }
          for (const linea of lineas) {
            if (!linea.cantidad.trim() || !linea.costo.trim() || !linea.margen.trim() || !linea.precio.trim()) {
              setError(`Completá cantidad, costo, margen y precio de ${linea.nombre}.`);
              return;
            }
          }
          setError("");
          const data = new FormData();
          data.set("comprobante", factura.trim());
          data.set("fecha", fecha);
          data.set("proveedorId", proveedorId);
          data.set(
            "lineas",
            JSON.stringify(
              lineas.map((linea) => ({
                productoId: linea.productoId,
                cantidad: Number(linea.cantidad),
                costo: Number(linea.costo.replace(/[^\d]/g, "")),
                margen: Number(linea.margen.replace(",", ".")),
                precio: Number(linea.precio.replace(/[^\d]/g, "")),
              })),
            ),
          );
          onGuardar(data);
        }}
      >
        {pending ? "Guardando…" : "Actualizar stock"}
      </button>
      {entradas.length > 0 && (
        <>
          <h3 className="mt-8 font-display text-2xl font-bold">Últimas entradas</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {entradas.slice(0, 8).map((entrada) => (
              <li key={entrada.id}>
                {entrada.codigo} {nombreVitrina(entrada.nombre)}: +{entrada.cantidad} · costo {formatoPesos(entrada.costoNuevo)} · venta {formatoPesos(entrada.precio)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function InventarioProductos({
  productos,
  proveedores,
  etiqueta,
  rubros,
  pending,
  aviso,
  onVolver,
  onGuardar,
}: {
  productos: ProductoCaja[];
  proveedores: Proveedor[];
  etiqueta: Record<string, string>;
  rubros: { clave: string; etiqueta: string }[];
  pending: boolean;
  aviso: ReactNode;
  onVolver: () => void;
  onGuardar: (data: FormData) => void;
}) {
  const [q, setQ] = useState("");
  const [seccion, setSeccion] = useState("todas");
  const [situacion, setSituacion] = useState("todos");
  const [elegido, setElegido] = useState<string | null>(null);
  const lista = useMemo(() => {
    const t = buscarTexto(q.trim());
    return productos.filter((p) => {
      if (seccion !== "todas" && p.seccion !== seccion) return false;
      if (situacion === "bajo" && !(p.stock != null && p.stockMinimo != null && p.stock <= p.stockMinimo)) return false;
      if (situacion === "sin" && p.stock !== 0) return false;
      if (situacion === "con" && !(typeof p.stock === "number" && p.stock > 0)) return false;
      if (!t) return true;
      return (
        buscarTexto(p.nombre).includes(t) ||
        buscarTexto(p.codigo).includes(t) ||
        (p.codigosBarra ?? []).some((c) => buscarTexto(c).includes(t))
      );
    });
  }, [productos, q, seccion, situacion]);
  const producto = productos.find((p) => p.id === elegido) ?? null;

  return (
    <section className="px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={caja.kicker}>Productos</p>
          <h2 className={caja.titulo}>Inventario</h2>
        </div>
        <button type="button" className={caja.boton} onClick={onVolver}>
          Volver
        </button>
      </div>
      <div className="mt-3">{aviso}</div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm font-bold">
          Buscar
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o código" className={`${caja.campo} mt-1 w-56`} />
        </label>
        <label className="text-sm font-bold">
          Sección
          <select value={seccion} onChange={(e) => setSeccion(e.target.value)} className={`${caja.campo} mt-1`}>
            <option value="todas">Todas</option>
            {rubros.map((rubro) => (
              <option key={rubro.clave} value={rubro.clave}>
                {rubro.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Situación
          <select value={situacion} onChange={(e) => setSituacion(e.target.value)} className={`${caja.campo} mt-1`}>
            <option value="todos">Todos</option>
            <option value="bajo">Bajo el mínimo</option>
            <option value="sin">Sin stock</option>
            <option value="con">Con stock</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-500">
        {lista.length} de {productos.length} productos
      </p>
      <div className="mt-2 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 bg-neutral-100 text-xs uppercase">
              <tr>
                <th className="px-2 py-2">Código</th>
                <th className="px-2 py-2">Producto</th>
                <th className="px-2 py-2 text-right">Stock</th>
                <th className="px-2 py-2 text-right">Mínimo</th>
                <th className="px-2 py-2 text-right">Costo</th>
                <th className="px-2 py-2 text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setElegido(p.id)}
                  className={`${caja.fila} ${elegido === p.id ? caja.filaActiva : ""}`}
                >
                  <td className="px-2 py-2 font-bold">{p.codigo}</td>
                  <td className="px-2 py-2">{nombreVitrina(p.nombre)}</td>
                  <td className="px-2 py-2 text-right">{p.stock == null ? "—" : p.stock}</td>
                  <td className="px-2 py-2 text-right">{p.stockMinimo == null ? "—" : p.stockMinimo}</td>
                  <td className="px-2 py-2 text-right">{p.costo == null ? "—" : formatoPesos(p.costo)}</td>
                  <td className="px-2 py-2 text-right font-bold">{formatoPesos(p.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && <p className="px-3 py-6 text-sm font-semibold text-neutral-500">No hay productos con ese filtro.</p>}
        </div>
        {producto ? (
          <EditorInventario key={producto.id} producto={producto} proveedores={proveedores} pending={pending} onGuardar={onGuardar} />
        ) : (
          <p className={`${caja.panel} p-4 text-sm text-neutral-600`}>Elegí un producto para editarlo.</p>
        )}
      </div>
    </section>
  );
}

function EditorInventario({
  producto,
  proveedores,
  pending,
  onGuardar,
}: {
  producto: ProductoCaja;
  proveedores: Proveedor[];
  pending: boolean;
  onGuardar: (data: FormData) => void;
}) {
  const [stock, setStock] = useState(producto.stock == null ? "" : String(producto.stock));
  const [stockMinimo, setStockMinimo] = useState(producto.stockMinimo == null ? "" : String(producto.stockMinimo));
  const [costo, setCosto] = useState(producto.costo == null ? "" : String(producto.costo));
  const [margen, setMargen] = useState(producto.margen == null ? "" : String(producto.margen));
  const [precio, setPrecio] = useState(String(producto.precio));
  const [proveedorId, setProveedorId] = useState(producto.proveedorId);
  const sugerido = sugerirPrecio(costo, margen);

  return (
    <form
      className={`${caja.panel} grid gap-2 p-4`}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData();
        data.set("productoId", producto.id);
        data.set("stock", stock);
        data.set("stockMinimo", stockMinimo);
        data.set("costo", costo);
        data.set("margen", margen);
        data.set("precio", precio);
        data.set("proveedorId", proveedorId);
        onGuardar(data);
      }}
    >
      <p className="font-display text-xl font-bold">
        {producto.codigo} · {nombreVitrina(producto.nombre)}
      </p>
      <label className="text-sm font-bold">
        Stock
        <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Sin control" className={`${caja.campo} mt-1`} />
      </label>
      <label className="text-sm font-bold">
        Stock mínimo
        <input value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} placeholder="Sin mínimo" className={`${caja.campo} mt-1`} />
      </label>
      <label className="text-sm font-bold">
        Costo
        <input value={textoMonto(costo)} onChange={(e) => {
          const valor = digitosMonto(e.target.value);
          setCosto(valor);
          const siguiente = sugerirPrecio(valor, margen);
          if (siguiente != null) setPrecio(String(siguiente));
        }} inputMode="numeric" className={`${caja.campo} mt-1`} />
      </label>
      <label className="text-sm font-bold">
        Margen %
        <input value={margen} onChange={(e) => {
          const valor = e.target.value;
          setMargen(valor);
          const siguiente = sugerirPrecio(costo, valor);
          if (siguiente != null) setPrecio(String(siguiente));
        }} placeholder="Ej. 30" className={`${caja.campo} mt-1`} />
      </label>
      <label className="text-sm font-bold">
        Precio de venta
        <input value={textoMonto(precio)} onChange={(e) => setPrecio(digitosMonto(e.target.value))} inputMode="numeric" required className={`${caja.campo} mt-1`} />
      </label>
      {sugerido != null && <p className="text-xs font-semibold text-neutral-600">Calculado: {formatoPesos(sugerido)}</p>}
      <label className="text-sm font-bold">
        Proveedor
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={`${caja.campo} mt-1`}>
          <option value="">Sin proveedor</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className={caja.primario}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
