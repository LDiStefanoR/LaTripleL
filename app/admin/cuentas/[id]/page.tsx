import { notFound, redirect } from "next/navigation";
import { AdminClienteActividad } from "@/components/AdminClienteActividad";
import { AdminNav } from "@/components/AdminNav";
import { contarNovedadesPendientes, resumenPorId } from "@/lib/cuentas";
import { listarPedidos } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";
import { listarUsuarios } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminClienteDeudaPage({ params }: Props) {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const { id } = await params;
  const encontrado = await resumenPorId(id);
  if (!encontrado) notFound();

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
        Actividad
      </h1>
      <AdminNav
        activa="cuentas"
        solicitudes={solicitudes}
        pedidosNuevos={pedidosNuevos}
        novedades={novedades}
      />
      <div className="mt-8">
        <AdminClienteActividad resumen={encontrado.resumen} />
      </div>
    </main>
  );
}
