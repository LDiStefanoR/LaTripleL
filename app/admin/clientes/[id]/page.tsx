import { notFound, redirect } from "next/navigation";
import { AdminClienteFicha } from "@/components/AdminClienteFicha";
import { AdminNav } from "@/components/AdminNav";
import {
  asegurarFichaCliente,
  contarNovedadesPendientes,
  resumenPorEmail,
} from "@/lib/cuentas";
import { listarPedidos, listarPedidosDeCliente } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";
import { buscarUsuarioPorId, listarUsuarios, sinPassword } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminClienteFichaPage({ params }: Props) {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const { id } = await params;
  const usuarioRaw = await buscarUsuarioPorId(id);
  if (!usuarioRaw) notFound();
  const usuario = sinPassword(usuarioRaw);

  if (usuario.rol === "cliente") {
    await asegurarFichaCliente({
      email: usuario.email,
      nombre: usuario.nombre,
      telefono: usuario.perfil?.telefono ?? "",
    });
  }

  const [{ resumen }, pedidosCli, pedidos, usuarios, novedades] = await Promise.all([
    resumenPorEmail(usuario.email).then((r) => ({ resumen: r?.resumen ?? null })),
    listarPedidosDeCliente({ usuarioId: usuario.id, email: usuario.email }),
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
        Ficha
      </h1>
      <AdminNav
        activa="clientes"
        solicitudes={solicitudes}
        pedidosNuevos={pedidosNuevos}
        novedades={novedades}
      />
      <div className="mt-8">
        <AdminClienteFicha
          usuario={usuario}
          resumen={resumen}
          pedidos={pedidosCli}
        />
      </div>
    </main>
  );
}
