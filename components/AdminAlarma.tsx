"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { contarAlertasAdmin } from "@/app/acciones/cuentas";
import type { AlertasAdmin } from "@/types/cuenta";

const CLAVE_OTROS = "latriplel-alerta-otros";

type Sirena = {
  ctx: AudioContext;
  timer: number;
};

function arrancarSirena(): Sirena | null {
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  let paso = 0;

  const pitar = () => {
    if (ctx.state === "closed") return;
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = paso % 2 === 0 ? 880 : 1174;
    ganancia.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(ganancia);
    ganancia.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    paso += 1;
  };

  pitar();
  const timer = window.setInterval(pitar, 320);
  void ctx.resume();
  return { ctx, timer };
}

function pararSirena(sirena: Sirena | null) {
  if (!sirena) return;
  window.clearInterval(sirena.timer);
  void sirena.ctx.close();
}

function firmaOtros(a: AlertasAdmin) {
  return `${a.solicitudes}:${a.novedades}`;
}

export function AdminAlarma({
  inicial,
  enCaja = false,
  onPedidos,
}: {
  inicial: AlertasAdmin;
  enCaja?: boolean;
  onPedidos?: () => void;
}) {
  const router = useRouter();
  const [alertas, setAlertas] = useState(inicial);
  const [silencioOtros, setSilencioOtros] = useState(false);
  const [audioListo, setAudioListo] = useState(false);
  const sirenaRef = useRef<Sirena | null>(null);
  const pedidosRef = useRef(inicial.pedidosNuevos);
  const tituloRef = useRef(
    typeof document === "undefined" ? "" : document.title,
  );

  const hayPedido = alertas.pedidosNuevos > 0;
  const hayOtros = alertas.solicitudes > 0 || alertas.novedades > 0;
  const sonar = hayPedido || (hayOtros && !silencioOtros);
  const mostrarBarra = hayPedido || (hayOtros && !silencioOtros);

  useEffect(() => {
    const desbloquear = () => {
      setAudioListo(true);
    };
    window.addEventListener("pointerdown", desbloquear);
    window.addEventListener("keydown", desbloquear);
    return () => {
      window.removeEventListener("pointerdown", desbloquear);
      window.removeEventListener("keydown", desbloquear);
    };
  }, []);

  useEffect(() => {
    if (!sonar || !audioListo) return;
    sirenaRef.current = arrancarSirena();
    return () => {
      pararSirena(sirenaRef.current);
      sirenaRef.current = null;
    };
  }, [sonar, audioListo]);

  useEffect(() => {
    if (!hayPedido) {
      if (tituloRef.current) document.title = tituloRef.current;
      return;
    }
    if (!tituloRef.current) tituloRef.current = document.title;
    const original = tituloRef.current;
    let encendido = false;
    const id = window.setInterval(() => {
      encendido = !encendido;
      document.title = encendido
        ? `¡Pedido nuevo! (${alertas.pedidosNuevos})`
        : original;
    }, 900);
    return () => {
      window.clearInterval(id);
      document.title = original;
    };
  }, [hayPedido, alertas.pedidosNuevos]);

  useEffect(() => {
    let cancelado = false;
    async function refrescar() {
      const actual = await contarAlertasAdmin();
      if (cancelado) return;
      setAlertas(actual);
      if (actual.pedidosNuevos !== pedidosRef.current) {
        pedidosRef.current = actual.pedidosNuevos;
        router.refresh();
      }
      try {
        const previa = sessionStorage.getItem(CLAVE_OTROS);
        const firma = firmaOtros(actual);
        if (!previa) {
          sessionStorage.setItem(CLAVE_OTROS, firma);
        } else if (firma !== previa) {
          const [s0, n0] = previa.split(":").map(Number);
          const sube =
            actual.solicitudes > (s0 || 0) || actual.novedades > (n0 || 0);
          if (sube) setSilencioOtros(false);
          sessionStorage.setItem(CLAVE_OTROS, firma);
        }
      } catch {
        /* sin sessionStorage */
      }
    }

    void refrescar();
    const id = window.setInterval(() => void refrescar(), 3000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, [router]);

  if (!mostrarBarra) return null;

  const partes: string[] = [];
  if (hayPedido) {
    partes.push(
      `${alertas.pedidosNuevos} pedido${alertas.pedidosNuevos === 1 ? "" : "s"} sin atender. La alarma se corta cuando ya no quedan pedidos por atender`,
    );
  }
  if (alertas.novedades > 0 && !silencioOtros) {
    partes.push(
      `${alertas.novedades} novedad${alertas.novedades === 1 ? "" : "es"} de cuenta`,
    );
  }
  if (alertas.solicitudes > 0 && !silencioOtros) {
    partes.push(
      `${alertas.solicitudes} solicitud${alertas.solicitudes === 1 ? "" : "es"} de registro`,
    );
  }

  return (
    <div className={enCaja ? "shrink-0 border-b border-cape/30 bg-cape px-4 py-2 text-white" : "sticky top-[57px] z-30 border-b border-cape/30 bg-cape px-4 py-2 text-white sm:top-[61px]"}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm font-bold">
        <p>
          {sonar && !audioListo
            ? "Tocá la pantalla una vez para habilitar el sonido. "
            : null}
          Alarma: {partes.join(" · ") || "Hay novedades para chequear"}.
        </p>
        <div className="flex gap-3">
          {alertas.novedades > 0 && !silencioOtros && (
            <Link href="/caja" className="underline underline-offset-2">
              Caja
            </Link>
          )}
          {hayPedido &&
            (onPedidos ? (
              <button type="button" className="underline underline-offset-2" onClick={onPedidos}>
                Pedidos
              </button>
            ) : (
              <Link href="/caja?vista=pedidos" className="underline underline-offset-2">
                Pedidos
              </Link>
            ))}
          {alertas.solicitudes > 0 && !silencioOtros && (
            <Link href="/caja" className="underline underline-offset-2">
              Caja
            </Link>
          )}
          {hayOtros && !silencioOtros && !hayPedido && (
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => setSilencioOtros(true)}
            >
              Silenciar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
