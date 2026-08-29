import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/auth-config";
import { leerSesionToken } from "@/lib/sesion-token";

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  const sesion = await leerSesionToken(
    request.cookies.get(COOKIE_SESION)?.value,
  );
  if (sesion?.rol === "admin") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/ingresar";
  url.searchParams.set("siguiente", "/admin");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
