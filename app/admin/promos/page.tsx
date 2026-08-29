import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { AdminPromosPanel } from "@/components/AdminPromosPanel";
import { contarNovedadesPendientes } from "@/lib/cuentas";
import { listarPedidos } from "@/lib/pedidos";
import { leerProductos } from "@/lib/productos";
import { combosActivos, ofertasActivas } from "@/lib/promos";
import { getSesion } from "@/lib/sesion";
import { listarUsuarios } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const [productos, ofertas, combos, pedidos, usuarios, novedades] = await Promise.all([
    leerProductos(),
    ofertasActivas(),
    combosActivos(),
    listarPedidos(),
    listarUsuarios(),
    contarNovedadesPendientes(),
  ]);
  const solicitudes = usuarios.filter((u) => u.estado === "pendiente").length;
  const pedidosNuevos = pedidos.filter((p) => p.estado === "sin_atender").length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-cape">
        Administración
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
        Promos
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Elegí productos del catálogo para 2x1, 3x2, combos de 2 o 3, o
        destacarlos en el carrusel y en Promos. Los afiches A4 se cargan en esa
        misma página.
      </p>
      <AdminNav
        activa="promos"
        solicitudes={solicitudes}
        pedidosNuevos={pedidosNuevos}
        novedades={novedades}
      />
      <div className="mt-8">
        <AdminPromosPanel productos={productos} ofertas={ofertas} combos={combos} />
      </div>
    </main>
  );
}
