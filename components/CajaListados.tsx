"use client";

import { useMemo, useState } from "react";
import { CajaVentasDia } from "@/components/CajaVentasDia";
import { caja } from "@/components/caja-estilo";
import type { VentaCaja } from "@/lib/caja";
import {
  armarListado,
  tituloListado,
  type ComprobanteListado,
  type DeudaListado,
  type ProductoListado,
  type RetiroListado,
  type TipoListado,
} from "@/lib/listados";
import { diaArgentina } from "@/lib/venta-texto";

const GRUPOS: { titulo: string; tipos: { id: TipoListado; texto: string }[] }[] = [
  {
    titulo: "Productos",
    tipos: [
      { id: "stock-actual", texto: "Stock actual" },
      { id: "stock-minimo", texto: "Stock mínimo" },
      { id: "sin-stock", texto: "Sin stock" },
      { id: "mas-vendidos", texto: "Más vendidos" },
      { id: "menos-vendidos", texto: "Menos vendidos" },
    ],
  },
  {
    titulo: "Ventas",
    tipos: [
      { id: "ventas", texto: "Ventas" },
      { id: "costo-ventas", texto: "Costo de productos" },
      { id: "ganancia", texto: "Ganancia" },
    ],
  },
  {
    titulo: "Compras",
    tipos: [
      { id: "valor-stock", texto: "Costo de mercadería" },
      { id: "compras-proveedor", texto: "Recepciones" },
      { id: "salidas-caja", texto: "Salidas de caja" },
    ],
  },
  {
    titulo: "Clientes",
    tipos: [
      { id: "mejores-clientes", texto: "Mejores clientes" },
      { id: "mas-deudas", texto: "Más deudas" },
      { id: "morosidad", texto: "Alta morosidad" },
    ],
  },
];

const CON_FECHAS = new Set<TipoListado>([
  "ventas",
  "costo-ventas",
  "ganancia",
  "mas-vendidos",
  "menos-vendidos",
  "mejores-clientes",
  "compras-proveedor",
  "salidas-caja",
]);

export function CajaListados({
  productos,
  ventas,
  deudas,
  comprobantes,
  retiros,
  etiqueta,
  pending,
  onAnular,
  onVolver,
}: {
  productos: ProductoListado[];
  ventas: VentaCaja[];
  deudas: DeudaListado[];
  comprobantes: ComprobanteListado[];
  retiros: RetiroListado[];
  etiqueta: Record<string, string>;
  pending: boolean;
  onAnular: (id: string) => void;
  onVolver: () => void;
}) {
  const hoy = diaArgentina();
  const [tipo, setTipo] = useState<TipoListado>("ventas");
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [q, setQ] = useState("");
  const usaFechas = CON_FECHAS.has(tipo);
  const filtro = {
    desde: usaFechas ? desde : "",
    hasta: usaFechas ? hasta : "",
    q,
  };
  const tabla = useMemo(
    () => armarListado(tipo, { productos, ventas, deudas, etiqueta, comprobantes, retiros }, filtro),
    [tipo, productos, ventas, deudas, etiqueta, comprobantes, retiros, filtro.desde, filtro.hasta, filtro.q],
  );
  const ventasVisibles = useMemo(() => {
    if (tipo !== "ventas") return [];
    const busqueda = q.trim().toLowerCase();
    return ventas.filter((venta) => {
      const dia = diaArgentina(new Date(venta.creadoEn));
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
      if (!busqueda) return true;
      return [venta.cliente, venta.empleado, String(venta.numero), venta.formaPago].some((parte) =>
        parte.toLowerCase().includes(busqueda),
      );
    });
  }, [tipo, ventas, desde, hasta, q]);

  const params = new URLSearchParams({ tipo });
  if (filtro.desde) params.set("desde", filtro.desde);
  if (filtro.hasta) params.set("hasta", filtro.hasta);
  if (filtro.q) params.set("q", filtro.q);

  return (
    <section className="px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={caja.kicker}>Informes</p>
          <h2 className={caja.titulo}>Listados</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/caja/listado?${params.toString()}`} className={caja.oscuro}>
            Bajar PDF
          </a>
          <a href={`/caja/listado?${params.toString()}&formato=xlsx`} className={caja.boton}>
            Bajar Excel
          </a>
          <button type="button" onClick={onVolver} className={caja.boton}>
            Volver
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo}>
            <p className={caja.kicker}>{grupo.titulo}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {grupo.tipos.map((opcion) => (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => setTipo(opcion.id)}
                  className={`${caja.chip} ${tipo === opcion.id ? caja.chipActivo : caja.chipIdle}`}
                >
                  {opcion.texto}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm font-bold">
          Buscar
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tipo === "ventas" ? "Factura, cliente o empleado" : "Nombre o código"}
            className={`${caja.campo} mt-1 w-64`}
          />
        </label>
        {usaFechas && (
          <>
            <label className="text-sm font-bold">
              Desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={`${caja.campo} mt-1`} />
            </label>
            <label className="text-sm font-bold">
              Hasta
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={`${caja.campo} mt-1`} />
            </label>
            <button
              type="button"
              className={caja.boton}
              onClick={() => {
                setDesde("");
                setHasta("");
              }}
            >
              Todo el historial
            </button>
            <button
              type="button"
              className={caja.boton}
              onClick={() => {
                setDesde(hoy);
                setHasta(hoy);
              }}
            >
              Solo hoy
            </button>
          </>
        )}
      </div>

      <h3 className="mt-6 font-display text-2xl font-bold">{tituloListado(tipo)}</h3>
      {tipo === "valor-stock" && (
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">
          Suma el stock por el último costo y por el precio de venta. El total de abajo es el dinero inmovilizado en mercadería.
        </p>
      )}
      {tipo === "compras-proveedor" && (
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">
          Cada fila es una factura cargada al recepcionar un pedido o al entrar mercadería sin pedido. El importe es el costo de lo que entró.
        </p>
      )}
      {tipo === "salidas-caja" && (
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">
          Retiros de efectivo registrados en la caja, por ejemplo pagos a proveedores o gastos.
        </p>
      )}
      {(tipo === "costo-ventas" || tipo === "ganancia") && (
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">
          El costo es el último cargado en cada producto. La ganancia es la venta menos ese costo. No incluye los listados de clientes.
        </p>
      )}
      <p className="mt-1 text-sm font-semibold text-neutral-500">{tabla.filas.length} filas</p>

      {tipo === "ventas" ? (
        <div className="mt-3">
          <CajaVentasDia ventas={ventasVisibles} pending={pending} onAnular={onAnular} titulo="" />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-neutral-100 text-xs uppercase">
              <tr>
                {tabla.columnas.map((columna) => (
                  <th key={columna} className="px-2 py-2">
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((fila, indice) => (
                <tr key={`${tipo}-${indice}`} className="border-t border-neutral-200">
                  {fila.map((celda, i) => (
                    <td key={`${indice}-${i}`} className="px-2 py-2">
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tabla.filas.length === 0 && (
            <p className="px-3 py-6 text-sm font-semibold text-neutral-500">No hay datos con ese filtro.</p>
          )}
        </div>
      )}
    </section>
  );
}
