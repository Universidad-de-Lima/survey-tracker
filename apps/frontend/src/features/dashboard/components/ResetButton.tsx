import { useEffect, useState } from 'react';

import { useResetCounts } from '@/features/dashboard/hooks/useSurveyCounts';

const SEGUNDOS_PARA_CANCELAR = 10;

/**
 * RESET: pone los contadores a cero para el siguiente salón.
 *
 * No lleva clave a propósito. Lo único que hay que evitar es un toque accidental en
 * la pantalla que se está proyectando, y de eso se encarga la confirmación —que
 * además se cancela sola para no quedarse armada.
 */
export function ResetButton() {
  const [confirmando, setConfirmando] = useState(false);
  const { mutate, isPending, isError, reset } = useResetCounts();

  useEffect(() => {
    if (!confirmando) {
      return undefined;
    }

    const temporizador = setTimeout(() => {
      setConfirmando(false);
      reset();
    }, SEGUNDOS_PARA_CANCELAR * 1000);

    return () => clearTimeout(temporizador);
  }, [confirmando, reset]);

  if (confirmando) {
    return (
      <div className="bg-red-50 border-4 border-red-400 rounded-lg p-6">
        <p className="text-xl sm:text-2xl font-bold text-red-800 text-center">
          ¿Poner los contadores a cero?
        </p>
        <p className="text-sm text-red-700 text-center mt-1">
          Se cancela solo en {SEGUNDOS_PARA_CANCELAR} segundos.
        </p>

        {isError && (
          <p className="text-sm text-red-600 text-center mt-3">
            No se pudo resetear. Revisa la conexión e intenta otra vez.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <button
            onClick={() => {
              setConfirmando(false);
              reset();
            }}
            disabled={isPending}
            className="px-6 py-4 text-lg font-semibold bg-white text-gray-800 border-2 border-gray-400 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="px-6 py-4 text-lg font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Reseteando…' : 'Sí, a cero'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      className="w-full px-6 py-6 text-2xl sm:text-3xl font-black tracking-widest bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
    >
      RESET
      <span className="block mt-1 text-sm sm:text-base font-normal tracking-normal text-gray-300">
        Contadores a cero para el siguiente salón
      </span>
    </button>
  );
}
