"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SesionPublica } from "@/types/auth";

const AuthContext = createContext<SesionPublica | null>(null);

export function AuthProvider({
  sesion,
  children,
}: {
  sesion: SesionPublica | null;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={sesion}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
