"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { contarAlertasAdmin } from "@/app/acciones/cuentas";
import type { AlertasAdmin } from "@/types/cuenta";

const CLAVE = "latriplel-alerta-firma";
const SONIDO = "/sonidos/alarma.wav";

function firmar(a: AlertasAdmin) {
  return `${a.solicitudes}:${a.pedidosNuevos}:${a.novedades}`;
}

function crearAudio() {
  const a = new Audio(SONIDO);
  a.preload = "auto";
  a.volume = 1;
  a.loop = false;
  return a;
}

export function AdminAlarma({ inicial }: { inicial: AlertasAdmin }) {
  const [alertas, setAlertas] = useState(inicial);
  const [aviso, setAviso] = useState(inicial.total > 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const avisoRef = useRef(aviso);
  const timerRef = useRef<number | null>(null);
  avisoRef.current = aviso;

  useEffect(() => {
    const audio = crearAudio();
    audioRef.current = audio;

    const programarSiguiente = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (!avisoRef.current) return;
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
      }, 700);
    };

    const alTerminar = () => {
      if (avisoRef.current) programarSiguiente();
    };
    audio.addEventListener("ended", alTerminar);

    const desbloquear = () => {
      window.removeEventListener("pointerdown", desbloquear);
      window.removeEventListener("keydown", desbloquear);
      audio.muted = true;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.muted = false;
          audio.currentTime = 0;
          if (avisoRef.current) void audio.play().catch(() => undefined);
        })
        .catch(() => {
          audio.muted = false;
        });
    };
    window.addEventListener("pointerdown", desbloquear);
    window.addEventListener("keydown", desbloquear);

    return () => {
      audio.removeEventListener("ended", alTerminar);
      window.removeEventListener("pointerdown", desbloquear);
      window.removeEventListener("keydown", desbloquear);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (aviso) {
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    } else {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      audio.pause();
      audio.currentTime = 0;
    }
  }, [aviso]);

  useEffect(() => {
    let cancelado = false;
    async function refrescar(sonarSiSube: boolean) {
      const actual = await contarAlertasAdmin();
      if (cancelado) return;
      setAlertas(actual);
      try {
        const previa = sessionStorage.getItem(CLAVE);
        const firma = firmar(actual);
        if (!previa) {
          sessionStorage.setItem(CLAVE, firma);
        } else if (sonarSiSube && firma !== previa) {
          const [s0, p0, n0] = previa.split(":").map(Number);
          const sube =
            actual.solicitudes > (s0 || 0) ||
            actual.pedidosNuevos > (p0 || 0) ||
            actual.novedades > (n0 || 0);
          if (sube) setAviso(true);
          sessionStorage.setItem(CLAVE, firma);
        }
      } catch {
        if (actual.total > 0 && sonarSiSube) setAviso(true);
      }
      if (actual.total === 0) setAviso(false);
    }

    void refrescar(false);
    const id = window.setInterval(() => void refrescar(true), 8000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, []);

  if (!aviso || alertas.total <= 0) return null;

  const partes: string[] = [];
  if (alertas.novedades > 0) {
    partes.push(
      `${alertas.novedades} novedad${alertas.novedades === 1 ? "" : "es"} de cuenta`,
    );
  }
  if (alertas.pedidosNuevos > 0) {
    partes.push(
      `${alertas.pedidosNuevos} pedido${alertas.pedidosNuevos === 1 ? "" : "s"} sin atender`,
    );
  }
  if (alertas.solicitudes > 0) {
    partes.push(
      `${alertas.solicitudes} solicitud${alertas.solicitudes === 1 ? "" : "es"} de registro`,
    );
  }

  return (
    <div className="sticky top-[57px] z-30 border-b border-cape/30 bg-cape px-4 py-2 text-white sm:top-[61px]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm font-bold">
        <p>Alarma: {partes.join(" · ") || "Hay novedades para chequear"}.</p>
        <div className="flex gap-3">
          {alertas.novedades > 0 && (
            <Link href="/admin/cuentas" className="underline underline-offset-2">
              Deudas
            </Link>
          )}
          {alertas.pedidosNuevos > 0 && (
            <Link href="/admin/pedidos" className="underline underline-offset-2">
              Pedidos
            </Link>
          )}
          {alertas.solicitudes > 0 && (
            <Link href="/admin/clientes" className="underline underline-offset-2">
              Clientes
            </Link>
          )}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => setAviso(false)}
          >
            Silenciar
          </button>
        </div>
      </div>
    </div>
  );
}
