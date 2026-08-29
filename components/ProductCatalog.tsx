"use client";

import { useMemo, useState } from "react";
import { ComboCard } from "@/components/ComboCard";
import { ProductCard } from "@/components/ProductCard";
import type { ComboVitrina } from "@/lib/combo";
import type { ProductoVitrina } from "@/types/producto";
import type { Rubro } from "@/types/rubro";

type Props = {
  productos: ProductoVitrina[];
  rubros: Rubro[];
  seccionInicial?: string;
  aviso?: string;
  combos?: ComboVitrina[];
};

const PAGE = 40;
type Orden = "relevancia" | "precio-asc" | "precio-desc" | "nombre";

export function ProductCatalog({
  productos,
  rubros,
  seccionInicial,
  aviso,
  combos = [],
}: Props) {
  const etiquetas = useMemo(
    () => Object.fromEntries(rubros.map((r) => [r.clave, r.etiqueta])),
    [rubros],
  );
  const [filtro, setFiltro] = useState<string>(
    seccionInicial === "promos" ||
      (seccionInicial && rubros.some((r) => r.clave === seccionInicial))
      ? seccionInicial
      : "todas",
  );
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("relevancia");
  const [visible, setVisible] = useState(PAGE);

  const conteos = useMemo(() => {
    const map: Record<string, number> = {
      todas: productos.length,
      promos:
        combos.length +
        productos.filter((p) => p.esPromo || p.enCombo).length,
    };
    for (const p of productos) {
      map[p.seccion] = (map[p.seccion] ?? 0) + 1;
    }
    return map;
  }, [productos, combos.length]);

  const listado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = productos.filter((p) => {
      if (filtro === "promos") return p.esPromo || Boolean(p.enCombo);
      if (filtro !== "todas" && p.seccion !== filtro) return false;
      if (!q) return true;
      const etiqueta = (etiquetas[p.seccion] ?? p.seccion).toLowerCase();
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        etiqueta.includes(q)
      );
    });
    const copia = [...filtrados];
    if (orden === "precio-asc") {
      copia.sort((a, b) => a.precioMostrar - b.precioMostrar);
    } else if (orden === "precio-desc") {
      copia.sort((a, b) => b.precioMostrar - a.precioMostrar);
    } else if (orden === "nombre") {
      copia.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    } else {
      copia.sort((a, b) => Number(b.esPromo) - Number(a.esPromo));
    }
    return copia;
  }, [productos, filtro, busqueda, etiquetas, orden]);

  const mostrados = listado.slice(0, visible);
  const mostrarCombos =
    (filtro === "promos" || filtro === "todas") &&
    combos.length > 0 &&
    !busqueda.trim();
  const tituloRubro =
    filtro === "todas"
      ? "Todos los productos"
      : filtro === "promos"
        ? "Promos de la semana"
        : (etiquetas[filtro] ?? filtro);

  function elegirRubro(clave: string) {
    setFiltro(clave);
    setVisible(PAGE);
  }

  return (
    <section id="catalogo" className="scroll-mt-24 bg-[#f4f5f7] pb-16">
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cape">
              Catálogo online
            </p>
            <h1 className="font-display text-3xl font-bold not-italic tracking-tight text-neutral-900">
              {tituloRubro}
            </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {productos.length} productos · Pedido online · Envío a Rosario
          </p>
          </div>
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">Buscar producto</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              ⌕
            </span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setVisible(PAGE);
              }}
              placeholder="Buscá producto, marca o código…"
              className="h-12 w-full rounded-xl border border-neutral-300 bg-neutral-50 pl-9 pr-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-movipack focus:bg-white focus:ring-2 focus:ring-movipack/20"
            />
          </label>
        </div>
      </div>

      {aviso && (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto max-w-7xl px-4 py-2.5 text-sm text-amber-950 sm:px-6">
            {aviso}
          </p>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 hidden text-[11px] font-bold uppercase tracking-wide text-neutral-400 lg:block">
            Categorías
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            <CatBtn
              active={filtro === "todas"}
              onClick={() => elegirRubro("todas")}
              label="Todas"
              count={conteos.todas ?? 0}
            />
            <CatBtn
              active={filtro === "promos"}
              onClick={() => elegirRubro("promos")}
              label="Promos"
              count={conteos.promos ?? 0}
            />
            {rubros.map((rubro) => (
              <CatBtn
                key={rubro.clave}
                active={filtro === rubro.clave}
                onClick={() => elegirRubro(rubro.clave)}
                label={rubro.etiqueta}
                count={conteos[rubro.clave] ?? 0}
              />
            ))}
          </div>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-500">
              <span className="font-bold text-neutral-800">
                {listado.length}
              </span>{" "}
              resultado{listado.length === 1 ? "" : "s"}
            </p>
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              Ordenar
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                className="h-10 rounded-lg border border-neutral-300 bg-white px-2 text-sm font-semibold text-neutral-800 outline-none focus:border-movipack"
              >
                <option value="relevancia">Destacados</option>
                <option value="precio-asc">Menor precio</option>
                <option value="precio-desc">Mayor precio</option>
                <option value="nombre">Nombre A–Z</option>
              </select>
            </label>
          </div>

          {listado.length === 0 && !mostrarCombos ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
              <p className="text-lg font-bold text-neutral-900">
                No encontramos ese producto
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Probá otra búsqueda o cambiá de categoría.
              </p>
            </div>
          ) : (
            <>
              {mostrarCombos && (
                  <section className="mb-8">
                    <h2 className="font-display text-xl font-bold not-italic text-neutral-900">
                      Combos
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Llevá 2 o 3 productos juntos y se aplica la promo en el
                      carrito.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                      {combos.map((c) => (
                        <ComboCard key={c.id} combo={c} />
                      ))}
                    </div>
                  </section>
                )}
              {filtro === "promos" && listado.length > 0 && (
                <h2 className="mb-4 font-display text-xl font-bold not-italic text-neutral-900">
                  Promos activas
                </h2>
              )}
              {listado.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {mostrados.map((p) => (
                <ProductCard
                  key={p.id}
                  producto={p}
                  etiqueta={etiquetas[p.seccion] ?? p.seccion}
                />
              ))}
            </div>
              )}
            </>
          )}

          {visible < listado.length && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((n) => n + PAGE)}
                className="h-12 rounded-xl border border-neutral-300 bg-white px-6 text-sm font-bold text-neutral-800 hover:border-movipack hover:text-movipack"
              >
                Mostrar más productos
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CatBtn({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition lg:w-full ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:ring-movipack/40"
      }`}
    >
      <span>{label}</span>
      <span
        className={`tabular-nums text-xs ${
          active ? "text-white/60" : "text-neutral-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
