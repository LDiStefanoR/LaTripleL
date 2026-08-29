function urlValida(valor: string) {
  try {
    return new URL(valor).origin;
  } catch {
    return null;
  }
}

/** Base del sitio para metadata (Vercel a veces deja NEXT_PUBLIC_SITE_URL vacío). */
export function urlBaseSitio() {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configurada) {
    const ok = urlValida(configurada);
    if (ok) return ok;
  }
  const produccion = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (produccion) {
    const ok = urlValida(
      produccion.startsWith("http") ? produccion : `https://${produccion}`,
    );
    if (ok) return ok;
  }
  const preview = process.env.VERCEL_URL?.trim();
  if (preview) {
    const ok = urlValida(`https://${preview}`);
    if (ok) return ok;
  }
  return "http://localhost:3005";
}
