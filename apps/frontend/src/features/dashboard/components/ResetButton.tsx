import { useState } from 'react';

import { useResetCounts } from '@/features/dashboard/hooks/useSurveyCounts';

export function ResetButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [operatorSecret, setOperatorSecret] = useState('');
  const { mutate, isPending, isError, reset } = useResetCounts();

  // La clave se teclea en cada operación y sólo vive en memoria: el dashboard es un
  // sitio estático público, así que cualquier clave incluida en el bundle sería
  // legible por cualquiera y no protegería nada.
  const handleConfirm = () => {
    mutate(operatorSecret, {
      onSuccess: () => {
        setShowConfirm(false);
        setOperatorSecret('');
      },
    });
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setOperatorSecret('');
    reset();
  };

  if (showConfirm) {
    return (
      <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
        <p className="text-sm text-red-800 font-medium mb-3 text-center">
          ⚠️ ¿Resetear todos los contadores a cero? Esta acción no se puede deshacer.
        </p>
        <label
          htmlFor="reset-operator-secret"
          className="block text-xs font-medium text-gray-700 mb-1"
        >
          Clave de operador
        </label>
        <input
          id="reset-operator-secret"
          type="password"
          autoComplete="off"
          value={operatorSecret}
          onChange={(event) => setOperatorSecret(event.target.value)}
          disabled={isPending}
          placeholder="••••••••"
          className="w-full mb-3 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black/50 disabled:opacity-50"
        />
        {isError && (
          <p className="text-xs text-red-600 mb-2 text-center">
            No se pudo resetear. Verifica la clave de operador e intenta nuevamente.
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
            disabled={isPending || operatorSecret.length === 0}
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
