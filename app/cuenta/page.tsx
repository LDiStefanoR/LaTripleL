import { redirect } from "next/navigation";
import { CuentaClientePanel } from "@/components/CuentaClientePanel";
import { ventasDeCliente } from "@/lib/caja";
import { leerAjustes } from "@/lib/ajustes";
import { leerCuentas, resumenPorEmail } from "@/lib/cuentas";
import { listarPedidosDeCliente } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";
import { buscarUsuarioPorEmail, sinPassword } from "@/lib/usuarios";
import { nombreVisible } from "@/lib/venta-texto";

export const dynamic = "force-dynamic";

export default async function CuentaPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/ingresar?siguiente=/cuenta");
  if (sesion.rol === "admin") redirect("/caja");
  if (sesion.rol === "caja") redirect("/caja");

  const usuarioRaw = await buscarUsuarioPorEmail(sesion.email);
  if (!usuarioRaw) redirect("/ingresar?siguiente=/cuenta");

  const [vinculo, data, pedidos, ventas, precios] = await Promise.all([
    resumenPorEmail(sesion.email),
    leerCuentas(),
    listarPedidosDeCliente({ usuarioId: usuarioRaw.id, email: sesion.email }),
    ventasDeCliente({
      clienteId: usuarioRaw.id,
      nombre: nombreVisible({
        nombre: usuarioRaw.nombre,
        apellido: usuarioRaw.perfil?.apellido,
      }),
    }),
    leerAjustes(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <CuentaClientePanel
        usuario={sinPassword(usuarioRaw)}
        resumen={vinculo?.resumen ?? null}
        ajustes={data.ajustes}
        tasas={precios}
        pedidos={pedidos}
        ventas={ventas.map((venta) => ({
          id: venta.id,
          numero: venta.numero,
          creadoEn: venta.creadoEn,
          formaPago: venta.formaPago,
          total: venta.total,
          lineas: venta.lineas.map((linea) => ({
            nombre: linea.nombre,
            cantidad: linea.cantidad,
            precio: linea.precio,
          })),
        }))}
      />
    </main>
  );
}
