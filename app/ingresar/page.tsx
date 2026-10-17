import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { rutaPorRol } from "@/lib/roles";
import { getSesion } from "@/lib/sesion";

export default async function IngresarPage() {
  const sesion = await getSesion();
  if (sesion) redirect(rutaPorRol(sesion.rol));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-bold italic text-movipack-deep">
        Ingresar
      </h1>
      <p className="mt-2 text-neutral-600">
        Entrá con tu teléfono o tu mail y el PIN. Si pediste cuenta y todavía no
        te aceptaron, vas a ver un aviso. Administración:
        digitalpreseciavip@gmail.com.
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
    </main>
  );
}
