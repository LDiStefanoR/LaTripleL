import { NextRequest } from "next/server";
import { armarPresupuestoPdf } from "@/lib/presupuesto-caja";
import { puedeCobrar } from "@/lib/roles";
import { getSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sesion = await getSesion();
  if (!sesion || !puedeCobrar(sesion.rol)) {
    return new Response("No autorizado", { status: 401 });
  }

  let body: {
    cliente?: string;
    telefono?: string;
    email?: string;
    descuento?: number;
    lineas?: { codigo: string; nombre: string; cantidad: number; precio: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Pedido inválido", { status: 400 });
  }

  const cliente = String(body.cliente ?? "").trim();
  const lineas = Array.isArray(body.lineas) ? body.lineas : [];
  if (!cliente || cliente === "Cliente genérico") {
    return new Response("Elegí un cliente para el presupuesto.", { status: 400 });
  }
  if (lineas.length === 0) {
    return new Response("Agregá productos a la venta.", { status: 400 });
  }

  const pdf = await armarPresupuestoPdf({
    cliente,
    telefono: body.telefono,
    email: body.email,
    descuento: body.descuento,
    lineas: lineas.map((l) => ({
      codigo: String(l.codigo ?? ""),
      nombre: String(l.nombre ?? "Producto"),
      cantidad: Math.max(1, Number(l.cantidad) || 1),
      precio: Math.max(0, Number(l.precio) || 0),
    })),
  });

  const nombre = `presupuesto-${cliente.replace(/[^\w\-]+/g, "_").slice(0, 40)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
