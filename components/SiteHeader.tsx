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
  { href: "/catalogo", label: "Catálogo" },
  { href: "/promos", label: "Promos" },
  { href: whatsappUrl(MENSAJE_PEDIDO_GENERAL), label: "Contacto", externo: true },
];

export function SiteHeader({ alertasIniciales }: { alertasIniciales?: AlertasAdmin }) {
  const pathname = usePathname();
  const sesion = useAuth();
  const [menu, setMenu] = useState(false);
  const [alertas, setAlertas] = useState<AlertasAdmin>(
    alertasIniciales ?? { solicitudes: 0, pedidosNuevos: 0, novedades: 0, total: 0 },
  );

  useEffect(() => {
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menu]);

  useEffect(() => {
    if (sesion?.rol !== "admin") return;
    let cancelado = false;
    async function refrescar() {
      const actual = await contarAlertasAdmin();
      if (!cancelado) setAlertas(actual);
    }
    void refrescar();
    const id = window.setInterval(() => void refrescar(), 4000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, [sesion?.rol, pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-movipack/15 bg-white/95 shadow-sm shadow-movipack/5 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl min-w-0 items-center gap-2 px-3 sm:h-auto sm:justify-between sm:gap-3 sm:px-6 sm:py-3">
        <Link
          href="/catalogo"
          className="flex min-w-0 shrink items-center gap-2 rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-movipack"
        >
          <BrandLogo variant="header" />
        </Link>

        <nav
          className="hidden items-center gap-6 text-sm font-semibold text-neutral-700 md:flex"
          aria-label="Navegación principal"
        >
          {links.map((l) => {
            const active =
              l.href === "/catalogo"
                ? pathname === "/" || pathname.startsWith("/catalogo")
                : l.href === "/promos"
                  ? pathname.startsWith("/promos")
                  : false;
            const clase = `transition hover:text-movipack hover:underline hover:decoration-movipack hover:underline-offset-4 ${
              active ? "text-movipack underline underline-offset-4" : ""
            }`;
            if ("externo" in l && l.externo) {
              return (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clase}
                >
                  {l.label}
                </a>
              );
            }
            return (
              <Link key={l.href} href={l.href} className={clase}>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {sesion?.rol === "admin" && (
            <div className="hidden items-center gap-2 lg:flex">
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
                href="/caja"
                className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                  pathname.startsWith("/caja")
                    ? "border-movipack bg-movipack/10 text-movipack"
                    : "border-movipack/30 text-movipack"
                }`}
              >
                Caja
              </Link>
            </div>
          )}
          {sesion?.rol === "caja" && (
            <Link
              href="/caja"
              className="hidden rounded-xl border border-movipack bg-movipack px-3 py-2 text-sm font-bold text-white sm:inline-flex"
            >
              Caja
            </Link>
          )}
          {sesion?.rol === "cliente" && (
            <Link
              href="/cuenta"
              className={`hidden rounded-xl border px-3 py-2 text-sm font-bold sm:inline-flex ${
                pathname.startsWith("/cuenta")
                  ? "border-movipack bg-movipack/10 text-movipack"
                  : "border-movipack/30 text-movipack"
              }`}
            >
              Mi perfil
            </Link>
          )}
          {!sesion && (
            <Link
              href="/ingresar"
              className="rounded-xl border border-movipack/30 px-2.5 py-2 text-sm font-bold text-movipack sm:px-3"
            >
              Ingresar
            </Link>
          )}
          {sesion && (
            <form action={salir} className="hidden sm:block">
              <button
                type="submit"
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Salir
              </button>
            </form>
          )}
          <CartButton />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-800 md:hidden"
            aria-expanded={menu}
            aria-label={menu ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? (
              <span className="text-xl leading-none">×</span>
            ) : (
              <span className="flex flex-col gap-1.5" aria-hidden>
                <span className="block h-0.5 w-4 rounded bg-current" />
                <span className="block h-0.5 w-4 rounded bg-current" />
                <span className="block h-0.5 w-4 rounded bg-current" />
              </span>
            )}
          </button>
        </div>
      </div>

      {menu && (
        <div className="border-t border-neutral-100 bg-white px-3 py-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Menú móvil">
            {links.map((l) => {
              const active =
                l.href === "/catalogo"
                  ? pathname === "/" || pathname.startsWith("/catalogo")
                  : l.href === "/promos"
                    ? pathname.startsWith("/promos")
                    : false;
              const clase = `rounded-xl px-3 py-3 text-base font-bold touch-manipulation ${
                active ? "bg-movipack/10 text-movipack" : "text-neutral-800"
              }`;
              if ("externo" in l && l.externo) {
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clase}
                    onClick={() => setMenu(false)}
                  >
                    {l.label}
                  </a>
                );
              }
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clase}
                  onClick={() => setMenu(false)}
                >
                  {l.label}
                </Link>
              );
            })}
            {sesion?.rol === "admin" && (
              <>
                <Link
                  href="/admin/pedidos"
                  className="rounded-xl px-3 py-3 text-base font-bold text-movipack"
                  onClick={() => setMenu(false)}
                >
                  Pedidos
                  {alertas.pedidosNuevos > 0 ? ` (${alertas.pedidosNuevos})` : ""}
                </Link>
                <Link
                  href="/admin/promos"
                  className="rounded-xl px-3 py-3 text-base font-bold text-movipack"
                  onClick={() => setMenu(false)}
                >
                  Promos admin
                </Link>
                <Link
                  href="/caja"
                  className="rounded-xl px-3 py-3 text-base font-bold text-movipack"
                  onClick={() => setMenu(false)}
                >
                  Caja
                </Link>
              </>
            )}
            {(sesion?.rol === "caja" || sesion?.rol === "cliente") && (
              <Link
                href={sesion.rol === "caja" ? "/caja" : "/cuenta"}
                className="rounded-xl px-3 py-3 text-base font-bold text-movipack"
                onClick={() => setMenu(false)}
              >
                {sesion.rol === "caja" ? "Caja" : "Mi perfil"}
              </Link>
            )}
            {sesion ? (
              <form action={salir}>
                <button
                  type="submit"
                  className="w-full rounded-xl px-3 py-3 text-left text-base font-bold text-neutral-700"
                >
                  Salir
                </button>
              </form>
            ) : null}
          </nav>
        </div>
      )}
    </header>
  );
}
