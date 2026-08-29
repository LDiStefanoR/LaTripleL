import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { AdminPedidosPanel } from "@/components/AdminPedidosPanel";
import { contarNovedadesPendientes } from "@/lib/cuentas";
import { listarPedidos } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";
import { listarUsuarios } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function AdminPedidosPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const [pedidos, usuarios, novedades] = await Promise.all([
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
        Pedidos
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Pedidos activos, totales del día, la semana y el mes, y búsqueda por
        cliente genérico o registrado. El estado lo cambiás acá; el cliente lo
        ve en Mi cuenta.
      </p>
      <AdminNav
        activa="pedidos"
        solicitudes={solicitudes}
        pedidosNuevos={pedidosNuevos}
        novedades={novedades}
      />
      <div className="mt-8">
        <AdminPedidosPanel pedidos={pedidos} />
      </div>
    </main>
  );
}
