import { redirect } from "next/navigation";
import { AdminCuentasLista } from "@/components/AdminCuentasLista";
import { AdminNav } from "@/components/AdminNav";
import { contarNovedadesPendientes, listarFichasAdmin } from "@/lib/cuentas";
import { listarPedidos } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";
import { listarUsuarios } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function AdminCuentasPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const [{ data, resumenes }, pedidos, usuarios, novedades] = await Promise.all([
    listarFichasAdmin(),
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
        Deudas
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Verde al día, amarillo con el primer recargo (5%), rojo desde la
        segunda semana de mora. Pinchá un cliente para ver su actividad,
        modificar tickets o cargarle uno nuevo.
      </p>
      <AdminNav
        activa="cuentas"
        solicitudes={solicitudes}
        pedidosNuevos={pedidosNuevos}
        novedades={novedades}
      />
      <div className="mt-8">
        <AdminCuentasLista
          resumenes={resumenes}
          novedades={data.novedades}
          solicitudes={data.solicitudes}
        />
      </div>
    </main>
  );
}
