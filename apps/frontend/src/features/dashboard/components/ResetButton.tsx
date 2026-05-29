import { useState } from 'react';

import { useResetCounts } from '@/features/dashboard/hooks/useSurveyCounts';

export function ResetButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate, isPending, isError, reset } = useResetCounts();

  const handleConfirm = () => {
    mutate(undefined, {
      onSuccess: () => setShowConfirm(false),
    });
  };

  const handleCancel = () => {
    setShowConfirm(false);
    reset();
  };

  if (showConfirm) {
    return (
      <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
        <p className="text-sm text-red-800 font-medium mb-3 text-center">
          ⚠️ ¿Resetear todos los contadores a cero? Esta acción no se puede deshacer.
        </p>
        {isError && (
          <p className="text-xs text-red-600 mb-2 text-center">
            Error al resetear contadores. Intenta nuevamente.
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
            disabled={isPending}
          >
            {isPending ? 'Reseteando...' : 'Sí, resetear'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="w-full px-4 py-3 text-sm bg-black text-white font-medium rounded-md hover:bg-gray-800 transition-colors"
    >
      Resetear Contadores
    </button>
  );
}
