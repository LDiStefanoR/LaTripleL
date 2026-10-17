"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function OcultarEnCaja({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/caja")) return null;
  return children;
}
