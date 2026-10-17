import type { ReactNode } from "react";

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      {children}
    </svg>
  );
}

export function IconoVenta() {
  return (
    <Icono>
      <path d="M4 7h16l-1.2 11H5.2L4 7Z" />
      <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
    </Icono>
  );
}

export function IconoStock() {
  return (
    <Icono>
      <path d="M3 8.5 12 4l9 4.5-9 4.5L3 8.5Z" />
      <path d="M3 8.5V16l9 4 9-4V8.5" />
      <path d="M12 13v7" />
    </Icono>
  );
}

export function IconoListado() {
  return (
    <Icono>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Icono>
  );
}

export function IconoCliente() {
  return (
    <Icono>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c1.2-3 3.4-4.5 7-4.5S17.8 16 19 19" />
    </Icono>
  );
}

export function IconoProducto() {
  return (
    <Icono>
      <path d="M4 8h16v11H4V8Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </Icono>
  );
}

export function IconoMantenimiento() {
  return (
    <Icono>
      <path d="M14.5 6.5a4 4 0 0 0-5.6 5.6L4 17l3 3 4.9-4.9a4 4 0 0 0 5.6-5.6l-2.2 2.2-1.6-1.6 2.2-2.2Z" />
    </Icono>
  );
}

export function IconoDeuda() {
  return (
    <Icono>
      <path d="M7 3h8l4 4v14H7V3Z" />
      <path d="M15 3v4h4M9 12h6M9 16h4" />
    </Icono>
  );
}

export function IconoAdmin() {
  return (
    <Icono>
      <path d="M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6l-7-3Z" />
      <path d="M9 12h6M12 9v6" />
    </Icono>
  );
}

export function IconoPedido() {
  return (
    <Icono>
      <path d="M3 7h11v8H3V7Z" />
      <path d="M14 10h4l3 3v2h-7v-5Z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </Icono>
  );
}

export function IconoEntrada() {
  return (
    <Icono>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 19h14" />
    </Icono>
  );
}

export function IconoRegularizar() {
  return (
    <Icono>
      <path d="M8 7H4v4" />
      <path d="M4 11a8 8 0 1 0 2-5" />
      <path d="M12 8v5l3 2" />
    </Icono>
  );
}

export function IconoInventario() {
  return (
    <Icono>
      <path d="M4 5h7v7H4V5ZM13 5h7v7h-7V5ZM4 14h7v5H4v-5ZM13 14h7v5h-7v-5Z" />
    </Icono>
  );
}

export function TarjetaAccion({
  icono,
  titulo,
  detalle,
  onClick,
  href,
}: {
  icono: ReactNode;
  titulo: string;
  detalle: string;
  onClick?: () => void;
  href?: string;
}) {
  const clase =
    "flex min-h-28 w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-movipack/40";
  const cuerpo = (
    <>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-movipack/10 text-movipack">
        {icono}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-xl font-bold leading-tight text-neutral-900">{titulo}</span>
        <span className="mt-1 block text-sm font-semibold text-neutral-500">{detalle}</span>
      </span>
    </>
  );
  if (href) {
    return (
      <a href={href} className={clase}>
        {cuerpo}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={clase}>
      {cuerpo}
    </button>
  );
}
