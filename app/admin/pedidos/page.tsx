import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPedidosPanel } from "@/components/AdminPedidosPanel";
import { listarCreditosPendientes } from "@/lib/cuentas";
import { listarPedidos } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function AdminPedidosPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const [pedidos, creditos] = await Promise.all([listarPedidos(), listarCreditosPendientes()]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-cape">
        Administración
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
        Pedidos
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        La mercadería se cobra desde la caja. El crédito y el saldo a cuenta se resuelven en su propia sección. Las ventas del día, la semana y el mes están en caja.
      </p>
      <p className="mt-3 text-sm font-bold">
        <Link href="/admin/promos" className="text-movipack underline">
          Ir a promos
        </Link>
      </p>
      <div className="mt-8">
        <AdminPedidosPanel pedidos={pedidos} creditos={creditos} />
      </div>
    </main>
  );
}
