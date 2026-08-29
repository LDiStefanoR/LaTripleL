"use server";

import { revalidatePath } from "next/cache";
import { crearPedido } from "@/lib/pedidos";
import { buscarUsuarioPorEmail } from "@/lib/usuarios";
import { getSesion } from "@/lib/sesion";
import type { LineaCarrito } from "@/lib/carrito";
import type {
  ContactoPedido,
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
} | null> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol === "admin") return null;
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!usuario || usuario.estado !== "activa") return null;
  return {
    nombre: usuario.nombre,
    email: usuario.email,
    perfil: usuario.perfil,
  };
}

export async function enviarPedidoWeb(
  lineas: LineaCarrito[],
  contacto: ContactoPedido,
  opciones: {
    franjaReparto: FranjaReparto;
    siFaltaProducto: SiFaltaProducto;
    modoEntrega: ModoEntrega;
    fechaEntrega: string;
  },
): Promise<EstadoPedidoWeb> {
  const sesion = await getSesion();
  const clienteRegistrado = sesion?.rol === "cliente";
  const usuario = clienteRegistrado
    ? await buscarUsuarioPorEmail(sesion.email)
    : null;

  const resultado = await crearPedido({
    lineas,
    contacto,
    franjaReparto: opciones.franjaReparto,
    siFaltaProducto: opciones.siFaltaProducto,
    modoEntrega: opciones.modoEntrega,
    fechaEntrega: opciones.fechaEntrega,
    clienteRegistrado,
    usuarioId: usuario?.id,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/pedidos");
  revalidatePath("/cuenta");
  revalidatePath("/", "layout");
  return {
    ok: "Recibimos tu pedido. Lo vamos a atender y te vamos a contactar.",
  };
}
