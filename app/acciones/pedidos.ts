"use server";

import { revalidatePath } from "next/cache";
import { resumenPorEmail } from "@/lib/cuentas";
import { crearPedido, crearRecargaCuenta } from "@/lib/pedidos";
import { buscarUsuarioPorEmail, recordarDireccion } from "@/lib/usuarios";
import { getSesion } from "@/lib/sesion";
import type { LineaCarrito } from "@/lib/carrito";
import type {
  ContactoPedido,
  FormaPagoPedido,
  FranjaReparto,
  ModoEntrega,
  SiFaltaProducto,
} from "@/types/pedido";
import type { PerfilCliente } from "@/types/auth";

export type EstadoPedidoWeb = { error?: string; ok?: string } | null;

export async function leerMiPerfil(): Promise<{
  nombre: string;
  email: string;
  perfil?: PerfilCliente;
  direcciones: string[];
  cuenta: { habilitada: boolean; disponible: number; saldo: number };
} | null> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol === "admin") return null;
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!usuario || usuario.estado !== "activa") return null;
  const vinculo = await resumenPorEmail(usuario.email);
  const limite = vinculo?.resumen.cliente.limiteAlmacen ?? 0;
  const cargadas = [
    usuario.perfil?.direccion ?? "",
    ...(usuario.perfil?.direcciones ?? []),
  ]
    .map((d) => d.trim())
    .filter((d, i, lista) => d.length >= 5 && lista.findIndex((o) => o.trim().toLowerCase() === d.toLowerCase()) === i);
  return {
    nombre: usuario.nombre,
    email: usuario.email,
    perfil: usuario.perfil,
    direcciones: cargadas,
    cuenta: {
      habilitada: limite > 0,
      disponible: vinculo?.resumen.disponibleAlmacen ?? 0,
      saldo: Math.max(0, Math.round(vinculo?.resumen.cliente.saldo ?? 0)),
    },
  };
}

export async function solicitarRecargaSaldo(monto: number): Promise<EstadoPedidoWeb> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== "cliente") return { error: "Tenés que entrar con tu cuenta." };
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!usuario || usuario.estado !== "activa") return { error: "No encontramos tu cuenta." };
  const resultado = await crearRecargaCuenta({
    usuarioId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    telefono: usuario.perfil?.telefono ?? "",
    monto,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidatePath("/admin/pedidos");
  revalidatePath("/caja");
  revalidatePath("/cuenta");
  return { ok: "Avisamos al local. Cuando confirme la transferencia, el saldo se suma." };
}

export async function enviarPedidoWeb(
  lineas: LineaCarrito[],
  contacto: ContactoPedido,
  opciones: {
    franjaReparto: FranjaReparto;
    siFaltaProducto?: SiFaltaProducto;
    modoEntrega: ModoEntrega;
    fechaEntrega: string;
    pago?: { forma: FormaPagoPedido; cuentaCorriente: number };
  },
): Promise<EstadoPedidoWeb> {
  const sesion = await getSesion();
  const clienteRegistrado = sesion?.rol === "cliente";
  const usuario = clienteRegistrado
    ? await buscarUsuarioPorEmail(sesion.email)
    : null;
  const vinculo =
    usuario && clienteRegistrado ? await resumenPorEmail(usuario.email) : null;
  const limite = vinculo?.resumen.cliente.limiteAlmacen ?? 0;

  const resultado = await crearPedido({
    lineas,
    contacto,
    franjaReparto: opciones.franjaReparto,
    siFaltaProducto: opciones.siFaltaProducto,
    modoEntrega: opciones.modoEntrega,
    fechaEntrega: opciones.fechaEntrega,
    pago: opciones.pago,
    cuenta: {
      habilitada: limite > 0,
      disponible: vinculo?.resumen.disponibleAlmacen ?? 0,
      saldo: Math.max(0, Math.round(vinculo?.resumen.cliente.saldo ?? 0)),
    },
    clienteRegistrado,
    usuarioId: usuario?.id,
  });
  if ("error" in resultado) return { error: resultado.error };
  if (usuario) await recordarDireccion(usuario.id, contacto.direccion);
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/pedidos");
  revalidatePath("/caja");
  revalidatePath("/cuenta");
  revalidatePath("/", "layout");
  return {
    ok: "Recibimos tu pedido. Lo vamos a atender y te vamos a contactar.",
  };
}
