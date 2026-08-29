export const COOKIE_SESION = "latriplel_sesion";
export const EMAIL_ADMIN = "digitalpreseciavip@gmail.com";
export const EMAIL_CLIENTE_DEMO = "leo.rds.21@gmail.com";
export const PASSWORD_ADMIN_SEMILLA = "Oficina123";

const ALIAS_ADMIN = new Set([
  "digitalpreseciavip@gmail.com",
  "digitalpresenciavip@gmail.com",
]);

export function normalizarEmailLogin(email: string) {
  const limpio = email.replace(/\s+/g, "").trim().toLowerCase();
  if (ALIAS_ADMIN.has(limpio)) return EMAIL_ADMIN;
  return limpio;
}

export function secretSesion() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Falta AUTH_SECRET en Vercel. Usamos una clave temporal; cargala en Environment Variables.",
    );
  }
  return "latriplel-dev-auth-secret-local";
}
