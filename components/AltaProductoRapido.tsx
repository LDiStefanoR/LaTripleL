"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearProductoRapido } from "@/app/acciones/imagenes";
import { caja } from "@/components/caja-estilo";
import { digitosMonto, formatoPesos, textoMonto } from "@/lib/format";
import { sugerirPrecio } from "@/lib/margen";
import type { Proveedor } from "@/lib/deposito";

export function AltaProductoRapido({
  rubros,
  proveedores,
  proveedorId,
  onCerrar,
  onListo,
}: {
  rubros: { clave: string; etiqueta: string }[];
  proveedores: Proveedor[];
  proveedorId?: string;
  onCerrar: () => void;
  onListo: (
    mensaje: string,
    producto?: { id: string; codigo: string; nombre: string; costo: number | null; margen: number | null; precio: number },
  ) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [costo, setCosto] = useState("");
  const [margen, setMargen] = useState("");
  const [precio, setPrecio] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const sugerido = sugerirPrecio(costo, margen);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-3 pt-6">
      <form
        className={`${caja.popup} max-w-3xl`}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError("");
          start(async () => {
            const resultado = await crearProductoRapido(data);
            if (resultado?.error) {
              setError(resultado.error);
              return;
            }
            router.refresh();
            onListo(resultado?.ok ?? "Cargamos el producto.", resultado?.producto);
            onCerrar();
          });
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={caja.kicker}>Catálogo</p>
            <h3 className="font-display text-2xl font-bold">Cargar producto</h3>
          </div>
          <button type="button" className={caja.boton} onClick={onCerrar}>
            Cerrar
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          Queda en el catálogo y en esta pantalla, sin salir del stock.
        </p>
        {error && <p className={`${caja.avisoErrorPlano} mt-3`}>{error}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Código
            <input name="codigo" required className={`${caja.campo} mt-1`} />
          </label>
          <label className="text-sm font-bold">
            Nombre
            <input name="nombre" required minLength={3} className={`${caja.campo} mt-1`} />
          </label>
          <label className="text-sm font-bold">
            Sección
            <select name="seccion" required defaultValue={rubros[0]?.clave ?? ""} className={`${caja.campo} mt-1`}>
              {rubros.map((rubro) => (
                <option key={rubro.clave} value={rubro.clave}>
                  {rubro.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Código de barras
            <input name="barra" placeholder="Uno o varios, separados por coma" className={`${caja.campo} mt-1`} />
          </label>
          <label className="text-sm font-bold">
            Costo
            <input
              name="costo"
              value={textoMonto(costo)}
              inputMode="numeric"
              onChange={(e) => {
                const valor = digitosMonto(e.target.value);
                setCosto(valor);
                const siguiente = sugerirPrecio(valor, margen);
                if (siguiente != null) setPrecio(String(siguiente));
              }}
              className={`${caja.campo} mt-1`}
            />
          </label>
          <label className="text-sm font-bold">
            Margen %
            <input
              name="margen"
              value={margen}
              inputMode="decimal"
              placeholder="Ej. 30"
              onChange={(e) => {
                const valor = e.target.value;
                setMargen(valor);
                const siguiente = sugerirPrecio(costo, valor);
                if (siguiente != null) setPrecio(String(siguiente));
              }}
              className={`${caja.campo} mt-1`}
            />
          </label>
          <label className="text-sm font-bold">
            Precio de venta
            <input
              name="precio"
              required
              value={textoMonto(precio)}
              inputMode="numeric"
              onChange={(e) => setPrecio(digitosMonto(e.target.value))}
              className={`${caja.campo} mt-1`}
            />
          </label>
          <label className="text-sm font-bold">
            Proveedor
            <select name="proveedorId" defaultValue={proveedorId ?? ""} className={`${caja.campo} mt-1`}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Stock inicial
            <input name="stock" inputMode="numeric" placeholder="Sin control" className={`${caja.campo} mt-1`} />
          </label>
          <label className="text-sm font-bold">
            Stock mínimo
            <input name="stockMinimo" inputMode="numeric" placeholder="Sin mínimo" className={`${caja.campo} mt-1`} />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Foto
            <input
              name="imagen"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={`${caja.campo} mt-1`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          {preview && (
            <img src={preview} alt="Vista previa del producto" className="h-24 w-24 rounded-xl object-cover" />
          )}
          {sugerido != null && (
            <p className="text-xs font-semibold text-neutral-600 sm:col-span-2">
              Con ese costo y ese margen, el precio calculado es {formatoPesos(sugerido)}. Si lo cambiás, se guarda el que escribiste.
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={caja.primario}>
            {pending ? "Guardando…" : "Cargar producto"}
          </button>
          <button type="button" className={caja.boton} onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
