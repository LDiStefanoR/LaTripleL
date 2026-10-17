import Link from "next/link";

type Props = {
  activa: "pedidos" | "promos";
  pedidosNuevos?: number;
};

function claseBoton(activo: boolean) {
  return `relative flex min-h-14 flex-col justify-center rounded-2xl border px-4 py-3 text-left text-sm font-bold shadow-sm ${
    activo
      ? "border-movipack bg-movipack text-white"
      : "border-movipack/20 bg-white text-movipack-deep hover:border-movipack hover:bg-movipack/5"
  }`;
}

function Badge({ n, claro }: { n: number; claro?: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={`absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
        claro ? "bg-white text-cape" : "bg-cape text-white"
      }`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function AdminNav({ activa, pedidosNuevos = 0 }: Props) {
  return (
    <nav className="mt-6 grid grid-cols-2 gap-2" aria-label="Secciones de administración">
      <Link href="/admin/pedidos" className={claseBoton(activa === "pedidos")}>
        Pedidos
        <span className={`text-xs font-semibold ${activa === "pedidos" ? "text-white/80" : "text-neutral-500"}`}>
          Notificaciones
        </span>
        <Badge n={pedidosNuevos} claro={activa === "pedidos"} />
      </Link>
      <Link href="/admin/promos" className={claseBoton(activa === "promos")}>
        Promos
        <span className={`text-xs font-semibold ${activa === "promos" ? "text-white/80" : "text-neutral-500"}`}>
          2x1, 3x2 y carrusel
        </span>
      </Link>
    </nav>
  );
}
