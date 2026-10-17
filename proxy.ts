import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/auth-config";
import { puedeCobrar } from "@/lib/roles";
import { leerSesionToken } from "@/lib/sesion-token";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const sesion = await leerSesionToken(
    request.cookies.get(COOKIE_SESION)?.value,
  );
  if (path.startsWith("/admin")) {
    if (sesion?.rol === "admin") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.searchParams.set("siguiente", "/admin");
    return NextResponse.redirect(url);
  }
  if (path.startsWith("/caja")) {
    if (puedeCobrar(sesion?.rol)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.searchParams.set("siguiente", "/caja");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/caja", "/caja/:path*"],
};
