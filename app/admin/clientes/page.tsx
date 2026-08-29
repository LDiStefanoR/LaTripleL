import { redirect } from "next/navigation";
import { AdminClientesLista } from "@/components/AdminClientesLista";
import { AdminNav } from "@/components/AdminNav";
import { contarNovedadesPendientes, listarResumenes } from "@/lib/cuentas";
import { listarPedidos } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";
import { listarUsuarios, sinPassword } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function AdminClientesPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const [{ resumenes }, pedidos, usuariosRaw, novedades] = await Promise.all([
    listarResumenes(),
    listarPedidos(),
    listarUsuarios(),
    contarNovedadesPendientes(),
  ]);
  const usuarios = usuariosRaw.map(sinPassword);
  const solicitudes = usuarios.filter((u) => u.estado === "pendiente").length;
  const pedidosNuevos = pedidos.filter((p) => p.estado === "sin_atender").length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-cape">
        Administración
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
        Clientes
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Buscá la ficha por nombre, mail, teléfono o dirección. Pinchá para
        abrirla: datos de contacto, envío, tipo de cliente, acceso y deuda.
      </p>
      <AdminNav
        activa="clientes"
        solicitudes={solicitudes}
        pedidosNuevos={pedidosNuevos}
        novedades={novedades}
      />
      <div className="mt-8">
        <AdminClientesLista
          usuarios={usuarios}
          resumenes={resumenes}
          pedidos={pedidos}
        />
      </div>
    </main>
  );
}
