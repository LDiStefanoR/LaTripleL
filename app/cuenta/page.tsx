import { redirect } from "next/navigation";
import { CuentaClientePanel } from "@/components/CuentaClientePanel";
import { leerCuentas, resumenPorEmail } from "@/lib/cuentas";
import { listarPedidosDeCliente } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";
import { buscarUsuarioPorEmail, sinPassword } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function CuentaPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/ingresar?siguiente=/cuenta");
  if (sesion.rol === "admin") redirect("/admin/cuentas");

  const usuarioRaw = await buscarUsuarioPorEmail(sesion.email);
  if (!usuarioRaw) redirect("/ingresar?siguiente=/cuenta");

  const [vinculo, data, pedidos] = await Promise.all([
    resumenPorEmail(sesion.email),
    leerCuentas(),
    listarPedidosDeCliente({ usuarioId: usuarioRaw.id, email: sesion.email }),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <CuentaClientePanel
        usuario={sinPassword(usuarioRaw)}
        resumen={vinculo?.resumen ?? null}
        ajustes={data.ajustes}
        pedidos={pedidos}
      />
    </main>
  );
}
