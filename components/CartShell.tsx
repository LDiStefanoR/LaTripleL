"use client";

import { CartDrawer } from "@/components/CartDrawer";
import { CartProvider } from "@/components/CartProvider";
import type { EscalaEnvio } from "@/types/ajustes";
import type { ReactNode } from "react";

export function CartShell({ children, envio }: { children: ReactNode; envio: EscalaEnvio }) {
  return (
    <CartProvider>
      {children}
      <CartDrawer envio={envio} />
    </CartProvider>
  );
}
