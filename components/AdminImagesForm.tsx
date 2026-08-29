"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  crearProducto,
  eliminarProducto,
  guardarNombreProducto,
  guardarPrecioProducto,
  subirImagenProducto,
} from "@/app/acciones/imagenes";
import { guardarSeccionProducto } from "@/app/acciones/admin";
import { formatoPesos } from "@/lib/format";
import { descuentoClienteDe } from "@/lib/precios";
import type { Producto } from "@/types/producto";
import type { Rubro } from "@/types/rubro";

type Props = {
  productos: Producto[];
  descuentoClienteGenerico: number;
  ajustePorSeccion: Record<string, number>;
  descuentoClientePorSeccion: Record<string, number>;
  rubros: Rubro[];
};

const PAGE = 18;

function precioPublico(producto: Producto, extra: number) {
  return Math.round(producto.precio * (1 + extra / 100));
}

export function AdminImagesForm({
  productos,
  descuentoClienteGenerico,
  ajustePorSeccion,
  descuentoClientePorSeccion,
  rubros,
}: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [seccion, setSeccion] = useState("todas");
  const [visible, setVisible] = useState(PAGE);
  const [ficha, setFicha] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(
    null,
  );
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const listado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (seccion !== "todas" && p.seccion !== seccion) return false;
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q)
      );
    });
  }, [productos, busqueda, seccion]);

  const mostrados = listado.slice(0, visible);

  function run(
    productoId: string,
    tarea: () => Promise<{ ok?: string; error?: string } | null>,
  ) {
    setCargandoId(productoId);
    setMensaje(null);
    startTransition(async () => {
      const resultado = await tarea();
      setCargandoId(null);
      setMensaje(resultado);
      if (resultado?.ok) router.refresh();
    });
  }

  function onFoto(productoId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    data.set("productoId", productoId);
    const archivo = data.get("imagen");
    if (!(archivo instanceof File) || archivo.size === 0) {
      setMensaje({ error: "Elegí una imagen de tu PC." });
      return;
    }
    run(productoId, () => subirImagenProducto(data));
  }

  function onPrecio(productoId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    data.set("productoId", productoId);
    run(productoId, () => guardarPrecioProducto(data));
  }

  function onSeccion(productoId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    data.set("productoId", productoId);
    run(productoId, () => guardarSeccionProducto(data));
  }

  function onNombre(productoId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    data.set("productoId", productoId);
    run(productoId, () => guardarNombreProducto(data));
  }

  function onEliminar(producto: Producto) {
    const ok = window.confirm(
      `¿Eliminar ${producto.codigo} — ${producto.nombre}? Esta acción saca el producto del catálogo.`,
    );
    if (!ok) return;
    const data = new FormData();
    data.set("productoId", producto.id);
    run(producto.id, () => eliminarProducto(data));
  }

  function onCrear(form: HTMLFormElement) {
    const data = new FormData(form);
    run("nuevo", async () => {
      const resultado = await crearProducto(data);
      if (resultado?.ok) form.reset();
      return resultado;
    });
  }

  return (
    <section
      id="fotos"
      className="rounded-2xl border border-movipack/15 bg-white p-5 shadow-sm"
    >
      <h2 className="font-display text-xl font-bold not-italic text-movipack-deep">
        Productos
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Buscá la ficha por nombre o código. Pinchá para abrirla: rubro, nombre,
        precio y foto. Las promociones se arman en Promos.
      </p>

      <form
        className="mt-5 space-y-3 rounded-xl border border-dashed border-movipack/30 bg-[#fff6ea] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onCrear(e.currentTarget);
        }}
      >
        <p className="text-sm font-bold text-movipack-deep">Nuevo producto</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-neutral-600">
              Nombre
            </span>
            <input
              name="nombre"
              required
              minLength={3}
              placeholder="Ej: Vaso térmico 8 oz x 25"
              className="w-full rounded-lg border border-movipack/20 px-3 py-2 outline-none focus:border-movipack focus:ring-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-neutral-600">
              Código
            </span>
            <input
              name="codigo"
              required
              placeholder="Ej: 890"
              className="w-full rounded-lg border border-movipack/20 px-3 py-2 outline-none focus:border-movipack focus:ring-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-neutral-600">
              Rubro
            </span>
            <select
              name="seccion"
              required
              defaultValue={rubros[0]?.clave}
              className="w-full rounded-lg border border-movipack/20 bg-white px-3 py-2 font-semibold outline-none focus:border-movipack"
            >
              {rubros.map((rubro) => (
                <option key={rubro.clave} value={rubro.clave}>
                  {rubro.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-neutral-600">
              Precio general (sin registrarse)
            </span>
            <input
              type="number"
              name="precio"
              min={1}
              step={1}
              required
              placeholder="0"
              className="w-full rounded-lg border border-movipack/20 px-3 py-2 font-bold outline-none focus:border-movipack focus:ring-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending && cargandoId === "nuevo"}
          className="rounded-lg bg-movipack px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending && cargandoId === "nuevo"
            ? "Creando…"
            : "Crear producto"}
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setVisible(PAGE);
          }}
          placeholder="Buscar ficha por nombre o código…"
          className="w-full rounded-xl border border-movipack/20 px-3 py-2 outline-none focus:border-movipack focus:ring-2"
        />
        <select
          value={seccion}
          onChange={(e) => {
            setSeccion(e.target.value);
            setVisible(PAGE);
          }}
          className="rounded-xl border border-movipack/20 bg-white px-3 py-2 font-semibold outline-none focus:border-movipack"
        >
          <option value="todas">Todos los rubros</option>
          {rubros.map((rubro) => (
            <option key={rubro.clave} value={rubro.clave}>
              {rubro.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {mensaje?.error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-cape">
          {mensaje.error}
        </p>
      )}
      {mensaje?.ok && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {mensaje.ok}
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {mostrados.map((producto) => {
          const extra = ajustePorSeccion[producto.seccion] ?? 0;
          const publico = precioPublico(producto, extra);
          const dto = descuentoClienteDe(producto.seccion, {
            descuentoClienteGenerico,
            ajustePorSeccion,
            descuentoClientePorSeccion,
          });
          const cliente = Math.round(publico * (1 - dto / 100));
          const ocupado = pending && cargandoId === producto.id;
          const abierta = ficha === producto.id;
          return (
            <li
              key={producto.id}
              className="rounded-xl border border-neutral-200"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 p-3 text-left"
                onClick={() => setFicha(abierta ? null : producto.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={producto.imagen}
                  src={producto.imagen}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg bg-neutral-50 object-contain"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-movipack-deep">
                    {producto.nombre}
                  </span>
                  <span className="text-xs text-neutral-500">
                    Cód. {producto.codigo} · {formatoPesos(publico)}
                  </span>
                </span>
                <span className="text-xs font-bold text-movipack">
                  {abierta ? "Cerrar" : "Abrir ficha"}
                </span>
              </button>
              {abierta && (
              <div className="flex flex-col gap-3 border-t border-neutral-100 p-3 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={producto.imagen}
                alt=""
                className="h-32 w-32 shrink-0 self-start rounded-xl bg-neutral-50 object-contain"
              />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-xs font-semibold text-neutral-400">
                  Cód. {producto.codigo}
                </p>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSeccion(producto.id, e.currentTarget);
                  }}
                >
                  <label className="min-w-40 flex-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Rubro
                    <select
                      name="seccion"
                      defaultValue={producto.seccion}
                      key={`${producto.id}-seccion-${producto.seccion}`}
                      className="mt-1 w-full rounded-lg border border-movipack/20 bg-white px-3 py-2 text-sm font-semibold normal-case outline-none focus:border-movipack"
                    >
                      {rubros.map((rubro) => (
                        <option key={rubro.clave} value={rubro.clave}>
                          {rubro.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={ocupado}
                    className="rounded-lg border border-movipack px-3 py-2 text-sm font-bold text-movipack disabled:opacity-60"
                  >
                    Guardar rubro
                  </button>
                </form>
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onNombre(producto.id, e.currentTarget);
                  }}
                >
                  <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Nombre
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      name="nombre"
                      required
                      minLength={3}
                      defaultValue={producto.nombre}
                      key={`${producto.id}-nombre-${producto.nombre}`}
                      className="min-w-0 flex-1 rounded-lg border border-movipack/20 px-3 py-2 font-semibold outline-none focus:border-movipack focus:ring-2"
                    />
                    <button
                      type="submit"
                      disabled={ocupado}
                      className="rounded-lg border border-movipack px-3 py-2 text-sm font-bold text-movipack disabled:opacity-60"
                    >
                      Guardar nombre
                    </button>
                  </div>
                </form>

                <form
                  className="rounded-xl bg-neutral-50 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onPrecio(producto.id, e.currentTarget);
                  }}
                >
                  <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Precio general (sin registrarse)
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-500">
                      $
                    </span>
                    <input
                      type="number"
                      name="precio"
                      min={1}
                      step={1}
                      defaultValue={publico}
                      key={`${producto.id}-${publico}`}
                      required
                      className="w-36 rounded-lg border border-movipack/20 px-3 py-2 font-bold outline-none focus:border-movipack focus:ring-2"
                    />
                    <button
                      type="submit"
                      disabled={ocupado}
                      className="rounded-lg bg-movipack px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {ocupado ? "Guardando…" : "Guardar precio"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    Cliente registrado ({dto}%): {formatoPesos(cliente)}
                  </p>
                </form>

                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onFoto(producto.id, e.currentTarget);
                  }}
                >
                  <input
                    type="file"
                    name="imagen"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-movipack file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white"
                  />
                  <label className="flex items-start gap-2 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      name="aplicarMismaFoto"
                      value="1"
                      className="mt-0.5"
                    />
                    Usar esta foto en todos los productos que hoy tienen la
                    misma imagen
                  </label>
                  <button
                    type="submit"
                    disabled={ocupado}
                    className="w-fit rounded-lg border border-movipack px-3 py-1.5 text-sm font-bold text-movipack disabled:opacity-60"
                  >
                    {ocupado ? "Subiendo…" : "Cargar foto"}
                  </button>
                </form>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => onEliminar(producto)}
                  className="w-fit rounded-lg px-3 py-1.5 text-sm font-bold text-cape hover:bg-red-50 disabled:opacity-60"
                >
                  Eliminar producto
                </button>
              </div>
              </div>
              )}
            </li>
          );
        })}
      </ul>

      {visible < listado.length && (
        <button
          type="button"
          onClick={() => setVisible((n) => n + PAGE)}
          className="mt-6 rounded-xl border border-movipack/30 px-4 py-2 text-sm font-bold text-movipack"
        >
          Ver más productos ({listado.length - visible} restantes)
        </button>
      )}

      {listado.length === 0 && (
        <p className="mt-6 text-sm text-neutral-600">
          No hay productos con esa búsqueda.
        </p>
      )}
    </section>
  );
}
