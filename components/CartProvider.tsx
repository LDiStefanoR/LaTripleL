"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CARRITO_STORAGE_KEY,
  esLineaEnvio,
  type LineaCarrito,
} from "@/lib/carrito";
import { preciosParaCarrito } from "@/app/acciones/precios";
import { useAuth } from "@/components/AuthProvider";
import type { ProductoVitrina } from "@/types/producto";
import type { ComboPromo } from "@/types/promo";

type CartContextValue = {
  lineas: LineaCarrito[];
  combos: ComboPromo[];
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  agregar: (producto: ProductoVitrina, opts?: { abrir?: boolean }) => void;
  agregarCombo: (productos: ProductoVitrina[]) => void;
  setCantidad: (id: string, cantidad: number) => void;
  quitar: (id: string) => void;
  vaciar: () => void;
  cargarPedido: (nuevas: LineaCarrito[]) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const sesion = useAuth();
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [combos, setCombos] = useState<ComboPromo[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CARRITO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LineaCarrito[];
        if (Array.isArray(parsed)) {
          setLineas(parsed.filter((l) => l.id && l.cantidad > 0 && !esLineaEnvio(l)));
        }
      }
    } catch {
      /* ignore */
    }
    setListo(true);
  }, []);

  const idsCarrito = lineas.map((l) => l.id).join("|");

  useEffect(() => {
    if (!listo) return;
    const ids = [...new Set(lineas.map((l) => l.id))];
    void preciosParaCarrito(ids).then((datos) => {
      setCombos(datos.combos);
      if (ids.length === 0) return;
      setLineas((prev) =>
        prev.map((linea) => {
          const actualizado = datos.precios.find((p) => p.id === linea.id);
          if (!actualizado) return linea;
          if (
            actualizado.precio === linea.precio &&
            actualizado.precioLista === linea.precioLista &&
            actualizado.descuentoCliente === linea.descuentoCliente &&
            actualizado.tipoPromo === linea.tipoPromo
          ) {
            return linea;
          }
          return {
            ...linea,
            precio: actualizado.precio,
            precioLista: actualizado.precioLista,
            descuentoCliente: actualizado.descuentoCliente,
            tipoPromo: actualizado.tipoPromo,
          };
        }),
      );
    });
  }, [sesion?.email, sesion?.rol, listo, idsCarrito, lineas.length]);

  useEffect(() => {
    if (!listo) return;
    localStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify(lineas));
  }, [lineas, listo]);

  const agregar = useCallback(
    (producto: ProductoVitrina, opts?: { abrir?: boolean }) => {
      setLineas((prev) => {
        const tope = typeof producto.stock === "number" ? producto.stock : null;
        if (tope === 0) return prev;
        const existente = prev.find((l) => l.id === producto.id);
        if (existente) {
          if (tope != null && existente.cantidad >= tope) return prev;
          return prev.map((l) =>
            l.id === producto.id
              ? { ...l, cantidad: l.cantidad + 1, stock: tope ?? l.stock }
              : l,
          );
        }
        return [
          ...prev,
          {
            id: producto.id,
            codigo: producto.codigo,
            nombre: producto.nombre,
            precio: producto.precioMostrar,
            precioLista: producto.precioLista,
            descuentoCliente: producto.descuentoCliente,
            tipoPromo: producto.tipoPromo,
            cantidad: 1,
            ...(tope != null ? { stock: tope } : {}),
          },
        ];
      });
      if (opts?.abrir !== false) setAbierto(true);
    },
    [],
  );

  const agregarCombo = useCallback((productos: ProductoVitrina[]) => {
    setLineas((prev) => {
      let next = [...prev];
      for (const producto of productos) {
        const existente = next.find((l) => l.id === producto.id);
        const tope = typeof producto.stock === "number" ? producto.stock : null;
        if (tope === 0) continue;
        if (existente) {
          if (tope != null && existente.cantidad >= tope) continue;
          next = next.map((l) =>
            l.id === producto.id
              ? { ...l, cantidad: l.cantidad + 1, stock: tope ?? l.stock }
              : l,
          );
        } else {
          next.push({
            id: producto.id,
            codigo: producto.codigo,
            nombre: producto.nombre,
            precio: producto.precioMostrar,
            precioLista: producto.precioLista,
            descuentoCliente: producto.descuentoCliente,
            tipoPromo: producto.tipoPromo,
            cantidad: 1,
            ...(tope != null ? { stock: tope } : {}),
          });
        }
      }
      return next;
    });
    setAbierto(true);
  }, []);

  const setCantidad = useCallback((id: string, cantidad: number) => {
    setLineas((prev) => {
      if (cantidad < 1) return prev.filter((l) => l.id !== id);
      return prev.map((l) => {
        if (l.id !== id) return l;
        const tope = typeof l.stock === "number" ? l.stock : cantidad;
        return { ...l, cantidad: Math.min(cantidad, Math.max(tope, 0)) };
      });
    });
  }, []);

  const quitar = useCallback((id: string) => {
    setLineas((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const vaciar = useCallback(() => setLineas([]), []);

  const cargarPedido = useCallback((nuevas: LineaCarrito[]) => {
    setLineas(
      nuevas
        .filter((l) => l.id && l.cantidad > 0 && !esLineaEnvio(l))
        .map((l) => ({
          id: l.id,
          codigo: l.codigo,
          nombre: l.nombre,
          precio: l.precio,
          precioLista: l.precioLista,
          tipoPromo: l.tipoPromo,
          cantidad: l.cantidad,
        })),
    );
    setAbierto(true);
  }, []);

  const value = useMemo(
    () => ({
      lineas,
      combos,
      abierto,
      abrir: () => setAbierto(true),
      cerrar: () => setAbierto(false),
      agregar,
      agregarCombo,
      setCantidad,
      quitar,
      vaciar,
      cargarPedido,
    }),
    [lineas, combos, abierto, agregar, agregarCombo, setCantidad, quitar, vaciar, cargarPedido],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart debe usarse dentro de CartProvider");
  }
  return ctx;
}
