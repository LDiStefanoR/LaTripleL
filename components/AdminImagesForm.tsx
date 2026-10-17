"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarCodigosBarra, guardarFichaProducto, subirImagenProducto, eliminarProducto } from "@/app/acciones/imagenes";
import { caja } from "@/components/caja-estilo";
import { digitosMonto, formatoPesos, textoMonto } from "@/lib/format";
import { sugerirPrecio } from "@/lib/margen";
import type { Proveedor } from "@/lib/deposito";
import type { Producto } from "@/types/producto";
import type { Rubro } from "@/types/rubro";

type Props = {
  productos: Producto[];
  descuentoClienteGenerico: number;
  ajustePorSeccion: Record<string, number>;
  rubros: Rubro[];
  proveedores: Proveedor[];
  onSalir: () => void;
};

type Borrador = {
  id: string | null;
  codigo: string;
  nombre: string;
  seccion: string;
  precio: string;
  stock: string;
  stockMinimo: string;
  costo: string;
  margen: string;
  proveedorId: string;
  mostrarEnCaja: boolean;
};

const POR_PAGINA = 4;

function precioVisible(producto: Producto, ajustePorSeccion: Record<string, number>) {
  const extra = ajustePorSeccion[producto.seccion] ?? 0;
  return Math.round(producto.precio * (1 + extra / 100));
}

export function AdminImagesForm({
  productos,
  descuentoClienteGenerico,
  ajustePorSeccion,
  rubros,
  proveedores,
  onSalir,
}: Props) {
  const router = useRouter();
  const [seccionFiltro, setSeccionFiltro] = useState("todas");
  const [paginaSeccion, setPaginaSeccion] = useState(0);
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(null);
  const [barrasAbiertas, setBarrasAbiertas] = useState(false);
  const [buscarAbierto, setBuscarAbierto] = useState(false);
  const [ubicarId, setUbicarId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [borrador, setBorrador] = useState<Borrador>(() => ({
    id: null,
    codigo: "",
    nombre: "",
    seccion: rubros[0]?.clave ?? "",
    precio: "",
    stock: "",
    stockMinimo: "",
    costo: "",
    margen: "",
    proveedorId: "",
    mostrarEnCaja: true,
  }));

  const filtros = useMemo(
    () => [{ clave: "todas", etiqueta: "Todas" }, ...rubros.map((r) => ({ clave: r.clave, etiqueta: r.etiqueta }))],
    [rubros],
  );
  const paginas = Math.max(1, Math.ceil(filtros.length / POR_PAGINA));
  const pagina = Math.min(paginaSeccion, paginas - 1);
  const visibles = filtros.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);

  const listado = useMemo(() => {
    return productos
      .filter((p) => seccionFiltro === "todas" || p.seccion === seccionFiltro)
      .slice()
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  }, [productos, seccionFiltro]);

  useEffect(() => {
    if (!ubicarId) return;
    document
      .querySelector<HTMLElement>(`[data-producto-id="${CSS.escape(ubicarId)}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [ubicarId, listado]);

  const elegido = productos.find((p) => p.id === borrador.id) ?? null;
  const precioNum = Number(borrador.precio.replace(/[^\d]/g, ""));
  const cliente =
    Number.isFinite(precioNum) && precioNum > 0
      ? Math.round(precioNum * (1 - descuentoClienteGenerico / 100))
      : null;

  function elegir(producto: Producto) {
    setBorrador({
      id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      seccion: producto.seccion,
      precio: String(precioVisible(producto, ajustePorSeccion)),
      stock: typeof producto.stock === "number" ? String(producto.stock) : "",
      stockMinimo: typeof producto.stockMinimo === "number" ? String(producto.stockMinimo) : "",
      costo: typeof producto.costo === "number" ? String(producto.costo) : "",
      margen: typeof producto.margen === "number" ? String(producto.margen) : "",
      proveedorId: producto.proveedorId ?? "",
      mostrarEnCaja: producto.mostrarEnCaja !== false,
    });
    setMensaje(null);
  }

  function nuevo() {
    setBorrador({
      id: null,
      codigo: "",
      nombre: "",
      seccion: seccionFiltro !== "todas" ? seccionFiltro : (rubros[0]?.clave ?? ""),
      precio: "",
      stock: "",
      stockMinimo: "",
      costo: "",
      margen: "",
      proveedorId: "",
      mostrarEnCaja: true,
    });
    setMensaje(null);
  }

  function ubicar(producto: Producto) {
    const index = filtros.findIndex((f) => f.clave === producto.seccion);
    setSeccionFiltro(producto.seccion);
    if (index >= 0) setPaginaSeccion(Math.floor(index / POR_PAGINA));
    elegir(producto);
    setUbicarId(producto.id);
    setBuscarAbierto(false);
  }

  function run(tarea: () => Promise<{ ok?: string; error?: string; id?: string } | null>) {
    setMensaje(null);
    startTransition(async () => {
      const resultado = await tarea();
      setMensaje(resultado);
      if (resultado?.id) {
        setBorrador((actual) => ({ ...actual, id: resultado.id ?? actual.id }));
      }
      if (resultado?.ok) router.refresh();
    });
  }

  function onGuardar(form: HTMLFormElement) {
    const data = new FormData(form);
    if (borrador.id) data.set("productoId", borrador.id);
    if (borrador.mostrarEnCaja) data.set("mostrarEnCaja", "1");
    else data.delete("mostrarEnCaja");
    run(() => guardarFichaProducto(data));
  }

  function onEliminar() {
    if (!elegido) {
      setMensaje({ error: "Elegí un producto de la lista para eliminarlo." });
      return;
    }
    const ok = window.confirm(
      `¿Eliminar ${elegido.codigo} — ${elegido.nombre}? Esta acción saca el producto del catálogo y de la caja.`,
    );
    if (!ok) return;
    const data = new FormData();
    data.set("productoId", elegido.id);
    run(async () => {
      const resultado = await eliminarProducto(data);
      if (resultado?.ok) nuevo();
      return resultado;
    });
  }

  function onFoto(form: HTMLFormElement) {
    if (!borrador.id) {
      setMensaje({ error: "Guardá el producto antes de cargar la foto." });
      return;
    }
    const data = new FormData(form);
    data.set("productoId", borrador.id);
    const archivo = data.get("imagen");
    if (!(archivo instanceof File) || archivo.size === 0) {
      setMensaje({ error: "Elegí una imagen de tu PC." });
      return;
    }
    run(() => subirImagenProducto(data));
    form.reset();
  }

  const campo = caja.campo;

  return (
    <section id="fotos" className="rounded-3xl border border-neutral-200 bg-white p-4 text-foreground shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-3 border-b border-neutral-100 pb-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-movipack text-lg text-white" aria-hidden>
          ⚙
        </span>
        <div>
          <p className={caja.kicker}>Mantenimiento</p>
          <h2 className="font-display text-2xl font-bold leading-none">Productos</h2>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <form
          id="ficha-producto"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            onGuardar(e.currentTarget);
          }}
        >
          <label className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-sm font-bold">
            Código *
            <input
              name="codigo"
              required
              value={borrador.codigo}
              onChange={(e) => setBorrador({ ...borrador, codigo: e.target.value })}
              className={`${campo} bg-confetti/25`}
            />
          </label>
          <label className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-sm font-bold">
            Nombre *
            <input
              name="nombre"
              required
              minLength={3}
              value={borrador.nombre}
              onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
              className={campo}
            />
          </label>
          <label className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-sm font-bold">
            Sección *
            <select
              name="seccion"
              required
              value={borrador.seccion}
              onChange={(e) => setBorrador({ ...borrador, seccion: e.target.value })}
              className={campo}
            >
              {rubros.map((rubro) => (
                <option key={rubro.clave} value={rubro.clave}>
                  {rubro.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-sm font-bold">
            Precio *
            <input
              name="precio"
              required
              inputMode="numeric"
              value={textoMonto(borrador.precio)}
              onChange={(e) => setBorrador({ ...borrador, precio: digitosMonto(e.target.value) })}
              className="w-40 rounded border border-neutral-500 bg-white px-2 py-1 text-4xl font-black leading-none outline-none focus:border-neutral-800"
            />
          </label>
          {cliente != null && (
            <p className="pl-[7.5rem] text-xs font-semibold text-neutral-700">
              Cliente registrado ({descuentoClienteGenerico}%): {formatoPesos(cliente)}
            </p>
          )}
          <label className="grid grid-cols-[7.5rem_8rem] items-center gap-2 text-sm font-bold">
            Costo
            <input
              name="costo"
              inputMode="numeric"
              value={textoMonto(borrador.costo)}
              onChange={(e) => {
                const costo = digitosMonto(e.target.value);
                const sugerido = sugerirPrecio(costo, borrador.margen);
                setBorrador({ ...borrador, costo, ...(sugerido != null ? { precio: String(sugerido) } : {}) });
              }}
              placeholder="Sin costo"
              className={campo}
            />
          </label>
          <label className="grid grid-cols-[7.5rem_8rem] items-center gap-2 text-sm font-bold">
            Margen %
            <input
              name="margen"
              inputMode="decimal"
              value={borrador.margen}
              onChange={(e) => {
                const margen = e.target.value;
                const sugerido = sugerirPrecio(borrador.costo, margen);
                setBorrador({ ...borrador, margen, ...(sugerido != null ? { precio: String(sugerido) } : {}) });
              }}
              placeholder="Ej. 30"
              className={campo}
            />
          </label>
          <p className="pl-[7.5rem] text-[11px] font-semibold text-neutral-600">
            Si cargás costo y margen, el precio de venta se calcula solo. Podés cambiarlo a mano.
          </p>
          <label className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-sm font-bold">
            Proveedor
            <select
              name="proveedorId"
              value={borrador.proveedorId}
              onChange={(e) => setBorrador({ ...borrador, proveedorId: e.target.value })}
              className={campo}
            >
              <option value="">Sin proveedor</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
            <span className="text-sm font-bold">Barras</span>
            <button
              type="button"
              onClick={() => {
                if (!borrador.id) {
                  setMensaje({ error: "Guardá el producto antes de cargar códigos de barra." });
                  return;
                }
                setBarrasAbiertas(true);
              }}
              className="rounded border border-neutral-700 bg-white px-3 py-2 text-left text-sm font-black"
            >
              Códigos de barra
              {elegido?.codigosBarra?.length ? ` (${elegido.codigosBarra.length})` : ""}
            </button>
          </div>
          <label className="grid grid-cols-[7.5rem_8rem] items-center gap-2 text-sm font-bold">
            Stock
            <input
              name="stock"
              inputMode="numeric"
              value={borrador.stock}
              onChange={(e) => setBorrador({ ...borrador, stock: e.target.value })}
              placeholder="Sin control"
              className={campo}
            />
          </label>
          <label className="grid grid-cols-[7.5rem_8rem] items-center gap-2 text-sm font-bold">
            Mínimo
            <input
              name="stockMinimo"
              inputMode="numeric"
              value={borrador.stockMinimo}
              onChange={(e) => setBorrador({ ...borrador, stockMinimo: e.target.value })}
              placeholder="Sin mínimo"
              className={campo}
            />
          </label>
          <p className="pl-[7.5rem] text-[11px] font-semibold text-neutral-600">
            Vacío: el stock no se controla. 0: no se puede vender.
          </p>
          <label className="flex items-center gap-2 pl-[7.5rem] text-sm font-bold">
            <input
              type="checkbox"
              checked={borrador.mostrarEnCaja}
              onChange={(e) => setBorrador({ ...borrador, mostrarEnCaja: e.target.checked })}
              className="h-4 w-4 accent-neutral-800"
            />
            Mostrar en caja
          </label>

          <div className="grid grid-cols-[7.5rem_1fr] gap-2 pt-2">
            <span className="text-sm font-bold">Imagen</span>
            <div>
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-background">
                {elegido?.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={elegido.imagen} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-2 text-center text-xs font-bold text-neutral-500">Sin foto</span>
                )}
              </div>
            </div>
          </div>
          <button type="submit" className="sr-only">
            Guardar ficha
          </button>
        </form>

        <div className="sm:pr-28">
          <p className={caja.kicker}>Filtrar por sección</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="Secciones anteriores"
              disabled={pagina === 0}
              onClick={() => setPaginaSeccion((n) => Math.max(0, n - 1))}
              className={caja.pager}
            >
              ‹
            </button>
            <div className="grid flex-1 grid-cols-2 gap-2">
              {visibles.map((filtro) => {
                const activo = seccionFiltro === filtro.clave;
                return (
                  <button
                    key={filtro.clave}
                    type="button"
                    onClick={() => setSeccionFiltro(filtro.clave)}
                    className={`${caja.chip} w-full ${activo ? caja.chipActivo : caja.chipIdle}`}
                  >
                    {filtro.etiqueta}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Secciones siguientes"
              disabled={pagina >= paginas - 1}
              onClick={() => setPaginaSeccion((n) => n + 1)}
              className={caja.pager}
            >
              ›
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className={caja.kicker}>Lista de productos</p>
            <span className="text-xs font-semibold text-neutral-600">{listado.length}</span>
          </div>
          <div className="mt-2 max-h-[28rem] overflow-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-neutral-100 text-xs">
                <tr>
                  <th className="px-2 py-1 font-black">Código</th>
                  <th className="px-2 py-1 font-black">Nombre</th>
                  <th className="px-2 py-1 text-right font-black">Precio</th>
                  <th className="px-2 py-1 text-right font-black">Costo</th>
                  <th className="px-2 py-1 text-right font-black">Stock</th>
                </tr>
              </thead>
              <tbody>
                {listado.map((producto) => {
                  const activo = producto.id === borrador.id;
                  return (
                    <tr
                      key={producto.id}
                      data-producto-id={producto.id}
                      onClick={() => elegir(producto)}
                      className={`${caja.fila} ${activo ? caja.filaActiva : ""}`}
                    >
                      <td className="px-2 py-1 font-semibold">{producto.codigo}</td>
                      <td className="max-w-48 truncate px-2 py-1">{producto.nombre}</td>
                      <td className="px-2 py-1 text-right font-semibold">
                        {precioVisible(producto, ajustePorSeccion)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {typeof producto.costo === "number" ? producto.costo : "—"}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {typeof producto.stock === "number" ? producto.stock : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {listado.length === 0 && (
              <p className="px-3 py-6 text-sm font-semibold text-neutral-500">
                No hay productos con ese filtro.
              </p>
            )}
          </div>
        </div>
      </div>

      {buscarAbierto && (
        <BuscarProducto
          productos={productos}
          rubros={rubros}
          ajustePorSeccion={ajustePorSeccion}
          onCerrar={() => setBuscarAbierto(false)}
          onElegir={ubicar}
        />
      )}

      {barrasAbiertas && elegido && (
        <CodigosBarra
          producto={elegido}
          onCerrar={() => setBarrasAbiertas(false)}
          onAviso={setMensaje}
        />
      )}

      {mensaje?.error && (
        <p className={`mt-3 ${caja.avisoErrorPlano}`}>
          {mensaje.error}
        </p>
      )}
      {mensaje?.ok && (
        <p className={`mt-3 ${caja.avisoOkPlano}`}>
          {mensaje.ok}
        </p>
      )}

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onFoto(e.currentTarget);
        }}
      >
        <input
          type="file"
          name="imagen"
          accept="image/jpeg,image/png,image/webp"
          className="max-w-full text-sm file:mr-2 file:rounded file:border file:border-neutral-500 file:bg-white file:px-2 file:py-1 file:text-sm file:font-bold"
        />
        <button
          type="submit"
          disabled={pending || !borrador.id}
          className={`${caja.boton} disabled:opacity-50`}
        >
          Cargar foto
        </button>
      </form>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <button
          type="submit"
          form="ficha-producto"
          disabled={pending}
          className={caja.primarioAlto}
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={nuevo}
          className={caja.primarioAlto}
        >
          Nuevo
        </button>
        <button
          type="button"
          onClick={() => setBuscarAbierto(true)}
          className={caja.primarioAlto}
        >
          Buscar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onEliminar}
          className={caja.peligroAlto}
        >
          Eliminar
        </button>
        <button
          type="button"
          onClick={onSalir}
          className={caja.oscuroAlto}
        >
          Salir
        </button>
      </div>
    </section>
  );
}

function CodigosBarra({
  producto,
  onCerrar,
  onAviso,
}: {
  producto: Producto;
  onCerrar: () => void;
  onAviso: (mensaje: { ok?: string; error?: string } | null) => void;
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [codigos, setCodigos] = useState(producto.codigosBarra ?? []);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function guardar(siguiente: string[]) {
    const data = new FormData();
    data.set("productoId", producto.id);
    data.set("codigos", JSON.stringify(siguiente));
    setError("");
    start(async () => {
      const resultado = await guardarCodigosBarra(data);
      if (resultado?.error) {
        setError(resultado.error);
        setTexto("");
        campo.current?.focus();
        return;
      }
      setCodigos(resultado?.codigos ?? siguiente);
      setTexto("");
      onAviso(resultado ? { ok: resultado.ok } : null);
      router.refresh();
      campo.current?.focus();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-3 pt-8">
      <form
        className={`${caja.popup} max-w-md`}
        onSubmit={(e) => {
          e.preventDefault();
          const codigo = texto.trim();
          if (!codigo || pending) return;
          if (codigos.some((c) => c.toLowerCase() === codigo.toLowerCase())) {
            setError("Ese código ya está en este producto.");
            setTexto("");
            campo.current?.focus();
            return;
          }
          guardar([...codigos, codigo]);
        }}
      >
        <p className={caja.kicker}>Códigos de barra</p>
        <h3 className="font-display text-2xl font-bold">{producto.nombre}</h3>
        <p className="text-sm font-semibold">Cód. {producto.codigo}</p>
        <p className="mt-2 text-sm font-semibold">
          {codigos.length === 0
            ? "Todavía no tiene códigos de barra."
            : `${codigos.length} código${codigos.length === 1 ? "" : "s"} cargado${codigos.length === 1 ? "" : "s"}.`}
        </p>
        <ul className="mt-2 max-h-64 overflow-auto rounded-2xl border border-neutral-200 bg-white">
          {codigos.map((codigo) => (
            <li key={codigo} className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 last:border-0">
              <span className="font-mono text-lg font-black">{codigo}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => guardar(codigos.filter((c) => c !== codigo))}
                className="rounded border border-neutral-700 px-2 py-1 text-sm font-black"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
        <label className="mt-3 block text-sm font-bold">
          Escanear o escribir
          <input
            ref={campo}
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="El lector manda Enter solo"
            className={`${caja.campo} font-mono text-lg`}
          />
        </label>
        {error && <p className="mt-2 text-sm font-bold text-red-800">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCerrar} className={caja.boton}>
            Cerrar
          </button>
          <button type="submit" disabled={pending} className={caja.primario}>
            {pending ? "Guardando…" : "Agregar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BuscarProducto({
  productos,
  rubros,
  ajustePorSeccion,
  onCerrar,
  onElegir,
}: {
  productos: Producto[];
  rubros: Rubro[];
  ajustePorSeccion: Record<string, number>;
  onCerrar: () => void;
  onElegir: (producto: Producto) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [seccion, setSeccion] = useState("");
  const [precio, setPrecio] = useState("");
  const [codigo, setCodigo] = useState("");
  const [barra, setBarra] = useState("");
  const [resultados, setResultados] = useState<Producto[] | null>(null);

  function etiqueta(clave: string) {
    return rubros.find((r) => r.clave === clave)?.etiqueta ?? clave;
  }

  function limpiar() {
    setNombre("");
    setSeccion("");
    setPrecio("");
    setCodigo("");
    setBarra("");
    setResultados(null);
  }

  function buscar() {
    const n = nombre.trim().toLowerCase();
    const c = codigo.trim().toLowerCase();
    const b = barra.trim().toLowerCase();
    const digitos = precio.replace(/[^\d]/g, "");
    const lista = productos
      .filter((p) => {
        if (n && !p.nombre.toLowerCase().includes(n)) return false;
        if (seccion && p.seccion !== seccion) return false;
        if (c && !p.codigo.toLowerCase().includes(c)) return false;
        if (b && !(p.codigosBarra ?? []).some((item) => item.toLowerCase().includes(b))) return false;
        if (digitos && !String(precioVisible(p, ajustePorSeccion)).includes(digitos)) return false;
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    setResultados(lista);
  }

  const etiquetaCampo = "grid grid-cols-[9.5rem_1fr] items-center gap-2 text-sm font-bold";
  const campoInput = caja.campo;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-3 pt-6">
      <div className={`${caja.popup} max-w-5xl`}>
        <div className="flex items-center gap-3 border-b border-neutral-400 pb-3">
          <span className="flex h-12 w-12 items-center justify-center rounded border border-neutral-700 bg-white text-2xl" aria-hidden>
            ⌕
          </span>
          <h3 className="font-display text-3xl font-bold">Buscar</h3>
        </div>

        <form
          className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
        >
          <div>
            <p className="text-center font-display text-2xl font-bold">Productos</p>
            <div className="mt-4 grid gap-3">
              <label className={etiquetaCampo}>
                Nombre
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campoInput} />
              </label>
              <label className={etiquetaCampo}>
                Sección
                <select value={seccion} onChange={(e) => setSeccion(e.target.value)} className={campoInput}>
                  <option value="">Todas</option>
                  {rubros.map((r) => (
                    <option key={r.clave} value={r.clave}>
                      {r.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label className={etiquetaCampo}>
                Precio
                <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="numeric" className={campoInput} />
              </label>
              <label className={etiquetaCampo}>
                Código
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className={campoInput} />
              </label>
              <label className={etiquetaCampo}>
                Código de barras
                <input value={barra} onChange={(e) => setBarra(e.target.value)} className={campoInput} />
              </label>
            </div>
          </div>

          <div className="flex min-h-80 flex-col">
            <p className="font-display text-lg font-bold">Resultado de la búsqueda</p>
            <div className="mt-2 min-h-72 flex-1 overflow-auto rounded-2xl border border-neutral-200 bg-white">
              {resultados === null ? null : resultados.length === 0 ? (
                <p className="px-3 py-6 text-sm font-semibold text-neutral-500">No hay productos con esos datos.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-neutral-100 text-xs">
                    <tr>
                      <th className="px-2 py-1 font-black">Código</th>
                      <th className="px-2 py-1 font-black">Nombre</th>
                      <th className="px-2 py-1 font-black">Sección</th>
                      <th className="px-2 py-1 text-right font-black">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((producto) => (
                      <tr
                        key={producto.id}
                        onDoubleClick={() => onElegir(producto)}
                        className={caja.fila}
                        title="Doble click para seleccionarlo"
                      >
                        <td className="px-2 py-1.5 font-semibold">{producto.codigo}</td>
                        <td className="px-2 py-1.5">{producto.nombre}</td>
                        <td className="px-2 py-1.5">{etiqueta(producto.seccion)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">
                          {formatoPesos(precioVisible(producto, ajustePorSeccion))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <p className="mt-1 text-xs font-semibold text-neutral-700">Doble click para seleccionar</p>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:col-span-1">
            <button type="button" onClick={limpiar} className={caja.boton}>
              Limpiar
            </button>
            <button type="submit" className={caja.primarioAlto}>
              Buscar
            </button>
            <button type="button" onClick={onCerrar} className={caja.oscuroAlto}>
              Salir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
