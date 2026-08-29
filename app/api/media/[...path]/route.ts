import { NextResponse } from "next/server";
import { leerBlobBinario } from "@/lib/blob-datos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  const { path } = await params;
  const pathname = path.map((p) => decodeURIComponent(p)).join("/");
  if (!pathname.startsWith("fotos/") && !pathname.startsWith("datos/")) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  try {
    const archivo = await leerBlobBinario(pathname);
    if (!archivo) return new NextResponse("No encontrado", { status: 404 });
    return new NextResponse(new Uint8Array(archivo.body), {
      headers: {
        "Content-Type": archivo.type,
        "Cache-Control": "private, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[media]", error);
    return new NextResponse("Error", { status: 500 });
  }
}
