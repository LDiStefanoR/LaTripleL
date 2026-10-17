"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminGuardarCombo,
  adminGuardarOferta,
  adminQuitarCombo,
  adminQuitarOferta,
  type EstadoPromo,
} from "@/app/acciones/promos";
import { formatoPesos, nombreVitrina, textoMonto } from "@/lib/format";
import { avisoCombo } from "@/lib/combo";
import { ETIQUETA_OFERTA } from "@/lib/oferta";
import type { Producto } from "@/types/producto";
import type { ComboPromo, Oferta, TipoOferta } from "@/types/promo";

export function AdminPromosPanel({
  productos,
  ofertas,
  combos,
}: {
  productos: Producto[];
  ofertas: Oferta[];
  combos: ComboPromo[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<TipoOferta>("2x1");
  const [elegido, setElegido] = useState<string | null>(null);
  const [tamCombo, setTamCombo] = useState<2 | 3>(2);
  const [comboIds, setComboIds] = useState<string[]>([]);
  const [qCombo, setQCombo] = useState("");
  const [mensaje, setMensaje] = useState<EstadoPromo>(null);
  const [pending, start] = useTransition();

  const porId = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos],
  );
  const enPromo = useMemo(
    () => new Set(ofertas.filter((o) => o.activa).map((o) => o.productoId)),
    [ofertas],
  );

  const enCombo = useMemo(
    () => new Set(combos.filter((c) => c.activa).flatMap((c) => c.productoIds)),
    [combos],
  );

  const listaCombo = useMemo(() => {
    const t = qCombo.trim().toLowerCase();
    if (t.length < 1) return [];
    return productos
      .filter((p) => !enCombo.has(p.id) && !comboIds.includes(p.id))
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(t) ||
          p.codigo.toLowerCase().includes(t),
      )
      .slice(0, 20);
  }, [productos, qCombo, enCombo, comboIds]);

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 1) return [];
    return productos
      .filter((p) => !enPromo.has(p.id))
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(t) ||
          p.codigo.toLowerCase().includes(t),
      )
      .slice(0, 20);
  }, [productos, q, enPromo]);

  function run(tarea: () => Promise<EstadoPromo>) {
    setMensaje(null);
    start(async () => {
      const r = await tarea();
      setMensaje(r);
      if (r?.ok) {
        setElegido(null);
        setQ("");
        setComboIds([]);
        setQCombo("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8">
      {mensaje?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-cape">
          {mensaje.error}
        </p>
      )}
      {mensaje?.ok && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {mensaje.ok}
        </p>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-xl font-bold not-italic text-movipack-deep">
          Armar una promo
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Buscá el producto, elegí 2x1, 3x2 o destacarlo en el carrusel y en la
          página de Promos.
        </p>

        <label className="mt-4 block text-sm font-bold text-movipack-deep">
          Buscar producto
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre o código"
            className="mt-1 w-full rounded-xl border border-movipack/20 px-3 py-2.5 text-sm outline-none focus:border-movipack"
          />
        </label>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(["2x1", "3x2", "precio"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                tipo === t
                  ? "border-cape bg-cape text-white"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              {t === "precio" ? "Destacar / carrusel" : ETIQUETA_OFERTA[t]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {tipo === "2x1"
            ? "En el carrito, cada 2 unidades se cobra 1."
            : tipo === "3x2"
              ? "En el carrito, cada 3 unidades se cobran 2."
              : "Sale en el carrusel y en Promos. Si cargás un precio, ese es el de la promo."}
        </p>

        <ul className="mt-4 space-y-2">
          {lista.length === 0 && (
            <li className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-500">
              {q.trim()
                ? "No hay productos libres con esa búsqueda."
                : "Escribí para buscar en el catálogo."}
            </li>
          )}
          {lista.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setElegido(p.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                  elegido === p.id
                    ? "border-movipack bg-movipack/10"
                    : "border-neutral-200 bg-white"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imagen}
                  alt=""
                  className="h-12 w-12 rounded-lg object-contain"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-movipack-deep">
                    {nombreVitrina(p.nombre)}
                  </span>
                  <span className="text-xs text-neutral-500">Cód. {p.codigo}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {elegido && (
          <form
            className="mt-4 space-y-3 rounded-xl border border-movipack/20 bg-[#fff6ea] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              data.set("productoId", elegido);
              data.set("tipo", tipo);
              data.set("carrusel", "1");
              run(() => adminGuardarOferta(data));
            }}
          >
            <p className="text-sm font-bold text-movipack-deep">
              {nombreVitrina(porId.get(elegido)?.nombre ?? "")} ·{" "}
              {tipo === "precio" ? "Destacar" : ETIQUETA_OFERTA[tipo]}
            </p>
            {tipo === "precio" && (
              <label className="block text-sm font-bold">
                Precio promo (opcional)
                <input
                  name="precioPromo"
                  inputMode="numeric"
                  placeholder="$0 o vacío para solo destacar"
                  onChange={(e) => {
                    const limpio = e.target.value.replace(/\D/g, "");
                    e.target.value = limpio ? textoMonto(limpio) : "";
                  }}
                  className="mt-1 w-full rounded-lg border border-movipack/20 px-3 py-2"
                />
              </label>
            )}
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-cape px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              Activar promo
            </button>
          </form>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-xl font-bold not-italic text-movipack-deep">
          Combo de 2 o 3 productos
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Elegí productos que juntos armen una promo. Sin precio, el más barato
          sale gratis. Si cargás un precio, ese es lo que se cobra el pack.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {([2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setTamCombo(n);
                setComboIds((ids) => ids.slice(0, n));
              }}
              className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                tamCombo === n
                  ? "border-cape bg-cape text-white"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              {n} productos
            </button>
          ))}
        </div>

        {comboIds.length > 0 && (
          <ul className="mt-4 space-y-2">
            {comboIds.map((id) => {
              const p = porId.get(id);
              if (!p) return null;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-xl border border-movipack/30 bg-movipack/5 px-3 py-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imagen} alt="" className="h-10 w-10 rounded-lg object-contain" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-movipack-deep">
                    {nombreVitrina(p.nombre)}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-bold text-cape"
                    onClick={() =>
                      setComboIds((ids) => ids.filter((x) => x !== id))
                    }
                  >
                    Quitar
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {comboIds.length < tamCombo && (
          <label className="mt-4 block text-sm font-bold text-movipack-deep">
            Buscar producto {comboIds.length + 1} de {tamCombo}
            <input
              value={qCombo}
              onChange={(e) => setQCombo(e.target.value)}
              placeholder="Nombre o código"
              className="mt-1 w-full rounded-xl border border-movipack/20 px-3 py-2.5 text-sm outline-none focus:border-movipack"
            />
          </label>
        )}
        {comboIds.length < tamCombo && (
          <ul className="mt-3 space-y-2">
            {listaCombo.length === 0 && (
              <li className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-500">
                {qCombo.trim()
                  ? "No hay productos libres con esa búsqueda."
                  : "Escribí para buscar en el catálogo."}
              </li>
            )}
            {listaCombo.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setComboIds((ids) => [...ids, p.id].slice(0, tamCombo));
                    setQCombo("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imagen} alt="" className="h-12 w-12 rounded-lg object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-movipack-deep">
                      {nombreVitrina(p.nombre)}
                    </span>
                    <span className="text-xs text-neutral-500">Cód. {p.codigo}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {comboIds.length === tamCombo && (
          <form
            className="mt-4 space-y-3 rounded-xl border border-movipack/20 bg-[#fff6ea] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              for (const id of comboIds) data.append("productoId", id);
              run(() => adminGuardarCombo(data));
            }}
          >
            <p className="text-sm font-bold text-movipack-deep">
              {avisoCombo(tamCombo)}
            </p>
            <label className="block text-sm font-bold">
              Precio del combo (opcional)
              <input
                name="precioCombo"
                inputMode="numeric"
                placeholder="$0 o vacío = el más barato sale gratis"
                onChange={(e) => {
                  const limpio = e.target.value.replace(/\D/g, "");
                  e.target.value = limpio ? textoMonto(limpio) : "";
                }}
                className="mt-1 w-full rounded-lg border border-movipack/20 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-cape px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              Activar combo
            </button>
          </form>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-xl font-bold not-italic text-movipack-deep">
          Promos activas
        </h2>
        <ul className="mt-4 space-y-2">
          {ofertas.length === 0 && combos.length === 0 && (
            <li className="text-sm text-neutral-500">Todavía no hay promos.</li>
          )}
          {combos.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-confetti/60 bg-[#fffbeb] px-3 py-2"
            >
              <div className="flex -space-x-2">
                {c.productoIds.map((id) => {
                  const p = porId.get(id);
                  if (!p) return null;
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={id}
                      src={p.imagen}
                      alt=""
                      className="h-12 w-12 rounded-lg border border-white object-contain"
                    />
                  );
                })}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-movipack-deep">
                  Combo {c.productoIds.length} productos
                </p>
                <p className="text-xs text-neutral-500">
                  {c.productoIds
                    .map((id) => nombreVitrina(porId.get(id)?.nombre ?? ""))
                    .join(" + ")}
                  {" · "}
                  {avisoCombo(c.productoIds.length, c.precioCombo)}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                className="text-sm font-bold text-cape"
                onClick={() => {
                  const data = new FormData();
                  data.set("id", c.id);
                  run(() => adminQuitarCombo(data));
                }}
              >
                Sacar
              </button>
            </li>
          ))}
          {ofertas.map((o) => {
            const p = porId.get(o.productoId);
            if (!p) return null;
            return (
              <li
                key={o.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imagen} alt="" className="h-12 w-12 rounded-lg object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-movipack-deep">
                    {nombreVitrina(p.nombre)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {o.tipo === "precio"
                      ? o.precioPromo
                        ? `Precio promo ${formatoPesos(o.precioPromo)}`
                        : "Destacada en carrusel y Promos"
                      : ETIQUETA_OFERTA[o.tipo]}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  className="text-sm font-bold text-cape"
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", o.id);
                    run(() => adminQuitarOferta(data));
                  }}
                >
                  Sacar
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-neutral-500">
          Los afiches A4 de Gemini se cargan en la página{" "}
          <a href="/promos" className="font-bold text-movipack underline">
            Promos
          </a>
          , para verlos del tamaño real.
        </p>
      </section>
    </div>
  );
}
