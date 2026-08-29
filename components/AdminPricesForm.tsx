"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  crearRubro,
  eliminarRubro,
  guardarPreciosAdmin,
  renombrarRubro,
  subirImagenRubro,
  type EstadoAdmin,
} from "@/app/acciones/admin";
import { RUBRO_RESERVADO } from "@/lib/categorias";
import type { Rubro } from "@/types/rubro";

type Props = {
  descuentoClienteGenerico: number;
  descuentoClientePorSeccion: Record<string, number>;
  cantidades: Record<string, number>;
  rubros: Rubro[];
};

function DtoRubroCampos({
  clave,
  activoInicial,
  valorInicial,
  general,
}: {
  clave: string;
  activoInicial: boolean;
  valorInicial: number;
  general: number;
}) {
  const [activo, setActivo] = useState(activoInicial);
  return (
    <div className="flex min-w-44 flex-col gap-1">
      <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
        <input
          type="checkbox"
          name={`dto-activo-${clave}`}
          value="1"
          checked={activo}
          onChange={(e) => setActivo(e.target.checked)}
          className="accent-movipack"
        />
        Usar descuento propio
      </label>
      <input
        type="number"
        name={`dto-${clave}`}
        defaultValue={valorInicial}
        min={0}
        max={90}
        step={1}
        disabled={!activo}
        className="w-20 rounded-lg border border-neutral-300 px-2 py-1 font-semibold outline-none focus:border-movipack disabled:bg-neutral-100 disabled:text-neutral-400"
        aria-label={`Descuento de clientes para ${clave}`}
      />
      {!activo && (
        <span className="text-[11px] text-neutral-400">Usa {general}%</span>
      )}
    </div>
  );
}

export function AdminPricesForm({
  descuentoClienteGenerico,
  descuentoClientePorSeccion,
  cantidades,
  rubros,
}: Props) {
  const router = useRouter();
  const [estado, action, pending] = useActionState<EstadoAdmin, FormData>(
    guardarPreciosAdmin,
    null,
  );
  const [mensajeRubro, setMensajeRubro] = useState<EstadoAdmin>(null);
  const [pendingRubro, startRubro] = useTransition();

  function runRubro(tarea: () => Promise<EstadoAdmin>) {
    setMensajeRubro(null);
    startRubro(async () => {
      const resultado = await tarea();
      setMensajeRubro(resultado);
      if (resultado?.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-8">
        <section className="rounded-2xl border border-movipack/15 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-bold not-italic text-movipack-deep">
            Descuento de clientes registrados
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Este porcentaje es el descuento general para clientes registrados,
            salvo los rubros donde actives un descuento propio. En el catálogo
            el cliente ve el precio ya rebajado y el % real de ese producto.
          </p>
          <label className="mt-4 flex items-center gap-3">
            <input
              type="number"
              name="descuentoClienteGenerico"
              defaultValue={descuentoClienteGenerico}
              min={0}
              max={90}
              step={1}
              className="w-24 rounded-xl border border-movipack/20 px-3 py-2 text-lg font-bold outline-none focus:border-movipack focus:ring-2"
            />
            <span className="font-semibold text-neutral-700">
              % de descuento
            </span>
          </label>
        </section>

        <section className="rounded-2xl border border-movipack/15 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-bold not-italic text-movipack-deep">
            Precios por rubro
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Acá definís si un rubro usa el descuento general de clientes (el de
            arriba) o uno propio. Si no activás “Usar descuento propio”, ese
            rubro toma el % general. Si lo activás, cargás el % de ese rubro y
            guardás: los clientes registrados ven ese descuento en esos
            productos, no el general. La foto de cada rubro es la que se ve en
            el inicio, en “Precios y productos”. Si creás o eliminás un rubro,
            el inicio se actualiza. Varios no se puede eliminar: si borrás
            otro, sus productos pasan ahí.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="py-2 font-semibold">Foto</th>
                  <th className="py-2 font-semibold">Rubro</th>
                  <th className="py-2 font-semibold">Productos</th>
                  <th className="py-2 font-semibold">Descuento clientes</th>
                  <th className="py-2 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {rubros.map((rubro) => (
                  <tr key={rubro.clave} className="border-b border-neutral-100">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-12 w-16 overflow-hidden rounded-lg bg-[#e8f0ff]">
                          {rubro.imagen ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rubro.imagen}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] font-bold text-neutral-400">
                              Sin foto
                            </div>
                          )}
                        </div>
                        <label className="cursor-pointer text-xs font-bold text-movipack hover:underline">
                          {rubro.imagen ? "Cambiar" : "Cargar"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={pendingRubro}
                            onChange={(e) => {
                              const archivo = e.target.files?.[0];
                              e.target.value = "";
                              if (!archivo) return;
                              const data = new FormData();
                              data.set("clave", rubro.clave);
                              data.set("imagen", archivo);
                              runRubro(() => subirImagenRubro(data));
                            }}
                          />
                        </label>
                      </div>
                    </td>
                    <td className="py-2 font-semibold text-movipack-deep">
                      {rubro.etiqueta}
                    </td>
                    <td className="py-2 text-neutral-600">
                      {cantidades[rubro.clave] ?? 0}
                    </td>
                    <td className="py-2">
                      <DtoRubroCampos
                        key={`${rubro.clave}-${descuentoClientePorSeccion[rubro.clave] ?? "g"}`}
                        clave={rubro.clave}
                        activoInicial={Object.prototype.hasOwnProperty.call(
                          descuentoClientePorSeccion,
                          rubro.clave,
                        )}
                        valorInicial={
                          descuentoClientePorSeccion[rubro.clave] ??
                          descuentoClienteGenerico
                        }
                        general={descuentoClienteGenerico}
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={pendingRubro}
                          className="text-sm font-bold text-movipack hover:underline disabled:opacity-60"
                          onClick={() => {
                            const nuevo = window.prompt(
                              "Nuevo nombre del rubro (el catálogo se actualiza):",
                              rubro.etiqueta,
                            );
                            if (!nuevo) return;
                            const data = new FormData();
                            data.set("clave", rubro.clave);
                            data.set("etiqueta", nuevo);
                            runRubro(() => renombrarRubro(data));
                          }}
                        >
                          Renombrar
                        </button>
                        {rubro.clave === RUBRO_RESERVADO ? (
                          <span className="text-xs font-semibold text-neutral-400">
                            No se puede eliminar
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={pendingRubro}
                            className="text-sm font-bold text-cape hover:underline disabled:opacity-60"
                            onClick={() => {
                              const cantidad = cantidades[rubro.clave] ?? 0;
                              const ok = window.confirm(
                                cantidad > 0
                                  ? `¿Eliminar el rubro "${rubro.etiqueta}"? ${cantidad} producto${cantidad === 1 ? "" : "s"} van a pasar a Varios y el catálogo se actualiza.`
                                  : `¿Eliminar el rubro "${rubro.etiqueta}"? El catálogo deja de mostrarlo.`,
                              );
                              if (!ok) return;
                              const data = new FormData();
                              data.set("clave", rubro.clave);
                              runRubro(() => eliminarRubro(data));
                            }}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {estado?.error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-cape">
            {estado.error}
          </p>
        )}
        {estado?.ok && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            {estado.ok}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-movipack px-6 py-3 text-sm font-bold text-white shadow-md disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      <form
        className="rounded-2xl border border-dashed border-movipack/30 bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          runRubro(async () => {
            const resultado = await crearRubro(new FormData(form));
            if (resultado?.ok) form.reset();
            return resultado;
          });
        }}
      >
        <h3 className="font-display text-lg font-bold not-italic text-movipack-deep">
          Crear rubro
        </h3>
        <p className="mt-1 text-sm text-neutral-600">
          El nuevo rubro aparece en el inicio y en el catálogo. Si cargás una
          foto, esa es la que se muestra en la grilla de inicio.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            name="etiqueta"
            required
            minLength={3}
            placeholder="Ej: Vasos"
            className="min-w-48 flex-1 rounded-xl border border-movipack/20 px-3 py-2 outline-none focus:border-movipack focus:ring-2"
          />
          <input
            name="imagen"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="max-w-56 text-sm text-neutral-600"
          />
          <button
            type="submit"
            disabled={pendingRubro}
            className="rounded-xl bg-movipack px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pendingRubro ? "Creando…" : "Crear rubro"}
          </button>
        </div>
        {mensajeRubro?.error && (
          <p className="mt-3 text-sm font-semibold text-cape">
            {mensajeRubro.error}
          </p>
        )}
        {mensajeRubro?.ok && (
          <p className="mt-3 text-sm font-semibold text-emerald-800">
            {mensajeRubro.ok}
          </p>
        )}
      </form>
    </div>
  );
}
