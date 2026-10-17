import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/RegisterForm";
import { rutaPorRol } from "@/lib/roles";
import { getSesion } from "@/lib/sesion";

export default async function RegistroPage() {
  const sesion = await getSesion();
  if (sesion) redirect(rutaPorRol(sesion.rol));

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-bold italic text-movipack-deep">
        Pedir cuenta de cliente
      </h1>
      <p className="mt-2 text-neutral-600">
        Completá estos datos. El administrador revisa la solicitud y, si la
        acepta, vas a poder ingresar y ver los precios de cliente.
      </p>
      <div className="mt-8">
        <RegisterForm />
      </div>
    </main>
  );
}
