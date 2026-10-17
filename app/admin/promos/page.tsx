import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPromosPanel } from "@/components/AdminPromosPanel";
import { leerProductos } from "@/lib/productos";
import { combosActivos, ofertasActivas } from "@/lib/promos";
import { getSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const [productos, ofertas, combos] = await Promise.all([
    leerProductos(),
    ofertasActivas(),
    combosActivos(),
  ]);

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
      <p className="mt-3 text-sm font-bold">
        <Link href="/admin/pedidos" className="text-movipack underline">
          Ir a pedidos
        </Link>
      </p>
      <div className="mt-8">
        <AdminPromosPanel productos={productos} ofertas={ofertas} combos={combos} />
      </div>
    </main>
  );
}
