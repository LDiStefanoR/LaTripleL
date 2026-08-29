import { redirect } from "next/navigation";
import { AdminImagesForm } from "@/components/AdminImagesForm";
import { AdminNav } from "@/components/AdminNav";
import { AdminPricesForm } from "@/components/AdminPricesForm";
import { leerAjustes } from "@/lib/ajustes";
import { listarPedidos } from "@/lib/pedidos";
import { leerProductos } from "@/lib/productos";
import { leerRubros } from "@/lib/rubros";
import { getSesion } from "@/lib/sesion";
import { listarUsuarios } from "@/lib/usuarios";
import { contarNovedadesPendientes } from "@/lib/cuentas";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const [ajustes, productos, pedidos, usuarios, novedades] = await Promise.all([
    leerAjustes(),
    leerProductos(),
    listarPedidos(),
    listarUsuarios(),
    contarNovedadesPendientes(),
  ]);
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  const cantidades: Record<string, number> = {};
  for (const producto of productos) {
    cantidades[producto.seccion] = (cantidades[producto.seccion] ?? 0) + 1;
  }
  const solicitudes = usuarios.filter((u) => u.estado === "pendiente").length;
  const pedidosNuevos = pedidos.filter((p) => p.estado === "sin_atender").length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-cape">
        Administración
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
        Precios, descuentos y fotos
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Sesión: {sesion.email}. Acá cambiás el descuento de clientes, creás o
        eliminás rubros y cada producto: rubro, nombre, precio y foto. Las
        promociones se arman en Promos.
      </p>
      <AdminNav
        activa="precios"
        solicitudes={solicitudes}
        pedidosNuevos={pedidosNuevos}
        novedades={novedades}
      />
      <div className="mt-6 rounded-2xl border border-movipack/15 bg-white p-4 shadow-sm">
        <p className="font-display text-lg font-bold not-italic text-movipack-deep">
          Descargar catálogo de precios
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Incluye foto, nombre, precio minorista (lista) y precio mayorista
          (con el descuento de cliente registrado).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/admin/catalogo-precios?formato=xlsx"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-movipack px-4 text-sm font-bold text-white shadow-md shadow-movipack/20 hover:bg-movipack-dark"
          >
            Descargar Excel
          </a>
          <a
            href="/admin/catalogo-precios?formato=pdf"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-movipack px-4 text-sm font-bold text-movipack hover:bg-movipack/5"
          >
            Descargar PDF
          </a>
        </div>
      </div>
      <div className="mt-6 flex gap-3 text-sm font-bold">
        <a href="#precios" className="text-movipack underline-offset-4 hover:underline">
          Precios
        </a>
        <a href="#fotos" className="text-movipack underline-offset-4 hover:underline">
          Productos
        </a>
      </div>
      <div id="precios" className="mt-8">
        <AdminPricesForm
          descuentoClienteGenerico={ajustes.descuentoClienteGenerico}
          descuentoClientePorSeccion={ajustes.descuentoClientePorSeccion}
          cantidades={cantidades}
          rubros={rubros}
        />
      </div>
      <div className="mt-10">
        <AdminImagesForm
          productos={productos}
          descuentoClienteGenerico={ajustes.descuentoClienteGenerico}
          ajustePorSeccion={ajustes.ajustePorSeccion}
          descuentoClientePorSeccion={ajustes.descuentoClientePorSeccion}
          rubros={rubros}
        />
      </div>
    </main>
  );
}
