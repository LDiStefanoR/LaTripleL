import { redirect } from "next/navigation";
import { CajaPanel } from "@/components/CajaPanel";
import { leerAjustes } from "@/lib/ajustes";
import { leerCuentas, listarFichasAdmin } from "@/lib/cuentas";
import { contarAlertasAdmin } from "@/app/acciones/cuentas";
import { leerVentasCaja, ultimoNumeroVenta, ventasDelDia } from "@/lib/caja";
import { leerRetirosCaja } from "@/lib/retiros-caja";
import {
  leerComprobantesCompra,
  leerEntradas,
  leerPedidosProveedor,
  leerProveedores,
  leerRegularizaciones,
} from "@/lib/deposito";
import { interesDeTicket } from "@/lib/deuda";
import { politicaDeCliente } from "@/lib/politica-cliente";
import { precioLista } from "@/lib/precios";
import { leerMediosPago } from "@/lib/medios-pago";
import { leerProductos } from "@/lib/productos";
import { permisosCajaDe } from "@/lib/permisos-caja";
import { puedeCobrar } from "@/lib/roles";
import { leerRubros } from "@/lib/rubros";
import { getSesion } from "@/lib/sesion";
import { listarUsuarios, normalizarEmail, sinPassword } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  const sesion = await getSesion();
  if (!sesion || !puedeCobrar(sesion.rol)) redirect("/ingresar?siguiente=/caja");

  const [ajustes, productos, ventas, historial, ultima, proveedores, pedidosProveedor, regularizaciones, entradas, usuarios, cuentas, mediosPago, alertasIniciales, retiros, comprobantes] =
    await Promise.all([
      leerAjustes(),
      leerProductos(),
      ventasDelDia(),
      leerVentasCaja(),
      ultimoNumeroVenta(),
      leerProveedores(),
      leerPedidosProveedor(),
      leerRegularizaciones(),
      leerEntradas(),
      listarUsuarios(),
      leerCuentas(),
      leerMediosPago(),
      contarAlertasAdmin(),
      leerRetirosCaja(),
      leerComprobantesCompra(),
    ]);
  const [rubros, fichas] = await Promise.all([
    leerRubros(productos.map((p) => p.seccion)),
    listarFichasAdmin(),
  ]);

  return (
    <CajaPanel
      empleado={sesion.nombre}
      esAdmin={sesion.rol === "admin"}
      ultimaFactura={ultima}
      ventas={ventas}
      historial={historial}
      rubros={rubros.map((r) => ({ clave: r.clave, etiqueta: r.etiqueta }))}
      productos={productos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        seccion: p.seccion,
        precio: precioLista(p, ajustes),
        stock: typeof p.stock === "number" ? p.stock : null,
        stockMinimo: typeof p.stockMinimo === "number" ? p.stockMinimo : null,
        costo: typeof p.costo === "number" ? p.costo : null,
        margen: typeof p.margen === "number" ? p.margen : null,
        proveedorId: p.proveedorId ?? "",
        mostrarEnCaja: p.mostrarEnCaja !== false,
        codigosBarra: p.codigosBarra ?? [],
      }))}
      proveedores={proveedores}
      pedidosProveedor={pedidosProveedor}
      regularizaciones={regularizaciones}
      entradas={entradas}
      personas={usuarios.map((u) => {
        const publico = sinPassword(u);
        const fiado = cuentas.clientes.find(
          (c) => normalizarEmail(c.email) === normalizarEmail(publico.email),
        );
        return {
          id: publico.id,
          nombre: publico.nombre,
          apellido: publico.perfil?.apellido ?? "",
          codigo: publico.perfil?.codigo ?? "",
          email: publico.email,
          rol: publico.rol,
          telefono: publico.perfil?.telefono ?? "",
          direccion: publico.perfil?.direccion ?? "",
          cumpleanos: publico.perfil?.cumpleanos ?? "",
          documento: publico.perfil?.documento ?? "",
          nota: publico.notaInterna ?? "",
          descuento: Math.min(100, Math.max(0, Math.round(publico.perfil?.descuento ?? 0))),
          cuentaWeb: !publico.email.endsWith("@mostrador.latriplel"),
          limiteAlmacen: fiado?.limiteAlmacen ?? 0,
          limiteEfectivo: fiado?.limiteEfectivo ?? 0,
          cuotasMaximas: fiado?.cuotasMaximas ?? 6,
          cuotasHabilitadas: fiado?.cuotasHabilitadas,
          interesModo: fiado?.interesModo,
          interes1: fiado?.interes1,
          interes2: fiado?.interes2,
          interes3: fiado?.interes3,
          interes6: fiado?.interes6,
          moraModo: fiado?.moraModo ?? "escala",
          moraPorcentaje: fiado?.moraPorcentaje ?? 0,
          moraCreditoModo: fiado?.moraCreditoModo,
          moraCreditoPorcentaje: fiado?.moraCreditoPorcentaje,
          moraCuentaModo: fiado?.moraCuentaModo,
          moraCuentaPorcentaje: fiado?.moraCuentaPorcentaje,
          plazoCuenta: fiado?.plazoCuenta,
          permisosCaja: publico.permisosCaja,
        };
      })}
      compras={historial.map((v) => ({
        id: v.id,
        numero: v.numero,
        creadoEn: v.creadoEn,
        cliente: v.cliente,
        clienteId: v.clienteId,
        formaPago: v.formaPago,
        total: v.total,
        anulada: v.anulada,
      }))}
      deudas={cuentas.clientes
        .map((cliente) => {
          const tickets = cuentas.tickets.filter(
            (t) => t.clienteId === cliente.id && t.estado === "vigente" && t.debe > 0,
          );
          const politica = politicaDeCliente(cliente, ajustes);
          return {
            nombre: cliente.nombre,
            email: cliente.email,
            telefono: cliente.telefono,
            debe: tickets.reduce((suma, t) => suma + t.debe, 0),
            interes: tickets.reduce((suma, t) => suma + interesDeTicket(t, undefined, politica).interes, 0),
            semanas: tickets.reduce((max, t) => Math.max(max, interesDeTicket(t, undefined, politica).semanas), 0),
            tickets: tickets.map((t) => ({
              numero: t.numero ?? "",
              fecha: t.fecha,
              descripcion: t.descripcion,
              debe: t.debe,
            })),
          };
        })
        .filter((d) => d.debe > 0)}
      fichaProductos={productos}
      fichaRubros={rubros}
      descuentoClienteGenerico={ajustes.descuentoClienteGenerico}
      tasasCuota={ajustes.tasasCuota}
      moraCredito={ajustes.moraCredito}
      moraCuenta={ajustes.moraCuenta}
      plazoCuenta={ajustes.plazoCuenta}
      permisos={permisosCajaDe(sesion.rol, usuarios.find((u) => normalizarEmail(u.email) === normalizarEmail(sesion.email))?.permisosCaja)}
      ajustePorSeccion={ajustes.ajustePorSeccion}
      mediosPago={mediosPago}
      fichas={fichas.resumenes}
      novedades={fichas.data.novedades}
      solicitudes={fichas.data.solicitudes}
      alertasIniciales={alertasIniciales}
      retiros={retiros}
      comprobantes={comprobantes}
      envio={ajustes.envio}
    />
  );
}
