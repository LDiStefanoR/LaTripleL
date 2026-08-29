"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { contarAlertasAdmin } from "@/app/acciones/cuentas";
import { salir } from "@/app/acciones/auth";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { CartButton } from "@/components/CartButton";
import { MENSAJE_PEDIDO_GENERAL } from "@/lib/categorias";
import { whatsappUrl } from "@/lib/whatsapp";

import type { AlertasAdmin } from "@/types/cuenta";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/promos", label: "Promos" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/#contacto", label: "Contacto" },
];

export function SiteHeader({ alertasIniciales }: { alertasIniciales?: AlertasAdmin }) {
  const pathname = usePathname();
  const sesion = useAuth();
  const [alertas, setAlertas] = useState<AlertasAdmin>(
    alertasIniciales ?? { solicitudes: 0, pedidosNuevos: 0, novedades: 0, total: 0 },
  );

  useEffect(() => {
    if (sesion?.rol !== "admin") return;
    let cancelado = false;
    async function refrescar() {
      const actual = await contarAlertasAdmin();
      if (!cancelado) setAlertas(actual);
    }
    void refrescar();
    const id = window.setInterval(() => void refrescar(), 20000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, [sesion?.rol, pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-movipack/15 bg-white/95 shadow-sm shadow-movipack/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-movipack"
        >
          <BrandLogo variant="header" />
        </Link>
        <nav
          className="flex items-center gap-3 text-sm font-semibold text-neutral-700 sm:gap-6"
          aria-label="Navegación principal"
        >
          {links.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : l.href === "/catalogo"
                  ? pathname.startsWith("/catalogo")
                  : l.href === "/promos"
                    ? pathname.startsWith("/promos")
                    : false;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`transition hover:text-movipack hover:underline hover:decoration-movipack hover:underline-offset-4 ${
                  active ? "text-movipack underline underline-offset-4" : ""
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {sesion?.rol === "admin" && (
            <>
              <Link
                href="/admin"
                className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                  pathname === "/admin"
                    ? "border-movipack bg-movipack/10 text-movipack"
                    : "border-movipack/30 text-movipack"
                }`}
              >
                Productos
              </Link>
              <Link
                href="/admin/pedidos"
                className={`relative rounded-xl border px-3 py-2 text-sm font-bold ${
                  pathname.startsWith("/admin/pedidos")
                    ? "border-movipack bg-movipack/10 text-movipack"
                    : "border-movipack/30 text-movipack"
                }`}
              >
                Pedidos
                {alertas.pedidosNuevos > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cape px-1 text-[11px] text-white">
                    {alertas.pedidosNuevos > 99 ? "99+" : alertas.pedidosNuevos}
                  </span>
                )}
              </Link>
              <Link
                href="/admin/clientes"
                className={`relative rounded-xl border px-3 py-2 text-sm font-bold ${
                  pathname.startsWith("/admin/clientes")
                    ? "border-movipack bg-movipack/10 text-movipack"
                    : "border-movipack/30 text-movipack"
                }`}
              >
                Clientes
                {alertas.solicitudes > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cape px-1 text-[11px] text-white">
                    {alertas.solicitudes > 99 ? "99+" : alertas.solicitudes}
                  </span>
                )}
              </Link>
              <Link
                href="/admin/cuentas"
                className={`relative rounded-xl border px-3 py-2 text-sm font-bold ${
                  pathname.startsWith("/admin/cuentas")
                    ? "border-movipack bg-movipack/10 text-movipack"
                    : "border-movipack/30 text-movipack"
                }`}
              >
                Deudas
                {alertas.novedades > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cape px-1 text-[11px] text-white">
                    {alertas.novedades > 99 ? "99+" : alertas.novedades}
                  </span>
                )}
              </Link>
            </>
          )}
          {sesion ? (
            <>
              {sesion.rol === "cliente" && (
                <Link
                  href="/cuenta"
                  className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                    pathname.startsWith("/cuenta")
                      ? "border-movipack bg-movipack/10 text-movipack"
                      : "border-movipack/30 text-movipack"
                  }`}
                >
                  Mi cuenta
                </Link>
              )}
              <form action={salir}>
              <button
                type="submit"
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Salir
              </button>
            </form>
            </>
          ) : (
            <Link
              href="/ingresar"
              className="rounded-xl border border-movipack/30 px-3 py-2 text-sm font-bold text-movipack"
            >
              Ingresar
            </Link>
          )}
          <CartButton />
          {sesion?.rol !== "admin" && (
            <a
              href={whatsappUrl(MENSAJE_PEDIDO_GENERAL)}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-700/25 transition hover:brightness-110 sm:inline-flex"
            >
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
