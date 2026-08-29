import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import type { Producto } from "@/types/producto";

export async function leerProductos(): Promise<Producto[]> {
  const parsed = await leerJsonData<Producto[]>("productos.json", []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function guardarProductos(productos: Producto[]) {
  return escribirJsonData("productos.json", productos);
}
