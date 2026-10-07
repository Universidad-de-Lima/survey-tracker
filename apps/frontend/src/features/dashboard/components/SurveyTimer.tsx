import { useEffect, useState } from 'react';

import type { SurveyTimerProps } from '@/features/dashboard/types';

const UN_SEGUNDO = 1000;

/** Milisegundos a «mm:ss», y a «h:mm:ss» cuando pasa de una hora. */
function formatear(ms: number): string {
  const total = Math.max(0, Math.floor(ms / UN_SEGUNDO));
  const segundos = total % 60;
  const minutos = Math.floor(total / 60) % 60;
  const horas = Math.floor(total / 3600);
  const dosDigitos = (n: number) => String(n).padStart(2, '0');

  return horas > 0
    ? `${horas}:${dosDigitos(minutos)}:${dosDigitos(segundos)}`
    : `${dosDigitos(minutos)}:${dosDigitos(segundos)}`;
}

/**
 * Cronómetro del salón: mide desde el primer escaneo hasta la última encuesta terminada.
 *
 * Mientras quede alguien respondiendo avanza en vivo; cuando ya no queda nadie pendiente se
 * queda fijo en el tiempo total que tardó el salón. Sin escaneos muestra 00:00, y el botón
 * RESET lo devuelve a cero para el siguiente salón.
 */
export function SurveyTimer({ firstScanAt, lastCompletedAt, pending, completed }: SurveyTimerProps) {
  const [ahora, setAhora] = useState(() => Date.now());
  const terminado = completed > 0 && pending === 0;

  useEffect(() => {
    if (!firstScanAt || terminado) {
      return;
    }

    const tic = setInterval(() => setAhora(Date.now()), UN_SEGUNDO);
    return () => clearInterval(tic);
  }, [firstScanAt, terminado]);

  const final = terminado ? (lastCompletedAt ?? ahora) : ahora;
  const transcurrido = firstScanAt ? final - firstScanAt : 0;

  return (
    <div
      className="flex flex-col items-center md:items-end mt-2 md:mt-0"
      aria-label="Tiempo del salón"
    >
      <span className="text-[11px] uppercase tracking-widest text-gray-500">Tiempo del salón</span>
      <span className="font-mono text-2xl md:text-3xl font-bold text-gray-800 tabular-nums">
        {formatear(transcurrido)}
      </span>
    </div>
  );
}
