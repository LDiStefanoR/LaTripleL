"use server";

import { revalidatePath } from "next/cache";
import { datosLocalDesde, type DatosLocal } from "@/lib/datos-local";
import { guardarAjustesCuenta, leerAjustesCuenta } from "@/lib/cuentas";
import { exigirPermisoCaja } from "@/lib/exigir-permiso";
import { guardarFotoSitio } from "@/lib/fotos-sitio";

export async function leerDatosLocal(): Promise<DatosLocal> {
  const ajustes = await leerAjustesCuenta();
  return datosLocalDesde({
    nombre: ajustes.nombreLocal,
    mail: ajustes.mailLocal,
    telefono: ajustes.telefonoLocal,
    direccion: ajustes.direccionLocal,
    horarios: ajustes.horariosLocal,
    alias: ajustes.alias,
    cbu: ajustes.cbu,
    titular: ajustes.titular,
    banco: ajustes.banco,
    demoraEntrega: ajustes.demoraEntrega,
    logo: ajustes.logoLocal,
  });
}

export async function guardarDatosLocal(
  form: FormData,
): Promise<{ error?: string; ok?: string } | null> {
  if (!(await exigirPermisoCaja("mantenimiento"))) return { error: "No tenés permiso." };
  const nombre = String(form.get("nombre") ?? "").trim();
  const demora = String(form.get("demoraEntrega") ?? "").trim();
  if (nombre.length < 2) return { error: "Cargá el nombre del local." };
  if (demora.length < 3) return { error: "Cargá el tiempo estimado de entrega." };

  const actual = await leerAjustesCuenta();
  let logoLocal = actual.logoLocal?.trim() || "";
  const archivo = form.get("logo");
  if (archivo instanceof File && archivo.size > 0) {
    if (!archivo.type.startsWith("image/")) {
      return { error: "El logo tiene que ser una imagen (JPG, PNG o WebP)." };
    }
    if (archivo.size > 4 * 1024 * 1024) {
      return { error: "El logo no puede pesar más de 4 MB." };
    }
    const ext =
      archivo.type === "image/png"
        ? "png"
        : archivo.type === "image/webp"
          ? "webp"
          : "jpg";
    const buffer = Buffer.from(await archivo.arrayBuffer());
    logoLocal = await guardarFotoSitio({
      carpeta: "web",
      nombre: `logo-presupuesto.${ext}`,
      buffer,
      mime: archivo.type || "image/jpeg",
    });
  }

  await guardarAjustesCuenta({
    nombreLocal: nombre,
    mailLocal: String(form.get("mail") ?? "").trim(),
    telefonoLocal: String(form.get("telefono") ?? "").trim(),
    direccionLocal: String(form.get("direccion") ?? "").trim(),
    horariosLocal: String(form.get("horarios") ?? "").trim(),
    alias: String(form.get("alias") ?? "").trim(),
    cbu: String(form.get("cbu") ?? "").replace(/\s/g, ""),
    titular: String(form.get("titular") ?? "").trim() || nombre,
    banco: String(form.get("banco") ?? "").trim(),
    demoraEntrega: demora,
    logoLocal,
  });
  revalidatePath("/");
  revalidatePath("/cuenta");
  revalidatePath("/catalogo");
  revalidatePath("/caja");
  return { ok: "Guardamos los datos del local." };
}
