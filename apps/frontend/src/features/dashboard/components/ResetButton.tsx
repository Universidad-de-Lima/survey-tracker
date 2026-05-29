import { useState } from 'react';

import { useResetCounts } from '@/features/dashboard/hooks/useSurveyCounts';

export function ResetButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const { mutate, isPending, isError, error, reset } = useResetCounts();

  const handleClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (!apiKey.trim()) return;
    mutate(apiKey.trim(), {
      onSuccess: () => {
        setShowConfirm(false);
        setApiKey('');
      },
    });
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setApiKey('');
    reset();
  };

  if (showConfirm) {
    return (
      <div className="mt-4 p-4 border border-red-300 bg-red-50 rounded-lg max-w-md mx-auto">
        <p className="text-sm text-red-800 font-medium mb-2">
          ⚠️ Esta acción reseteará todos los contadores a cero. Esta acción no se puede deshacer.
        </p>
        <input
          type="password"
          placeholder="Ingresa la API Key de reset"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-red-400"
          disabled={isPending}
        />
        {isError && (
          <p className="text-xs text-red-600 mb-2">
            {(error as Error)?.message === 'HTTP error! status: 401'
              ? 'API Key inválida. Verifica e intenta nuevamente.'
              : 'Error al resetear contadores. Intenta nuevamente.'}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
            disabled={isPending || !apiKey.trim()}
          >
            {isPending ? 'Reseteando...' : 'Confirmar Reset'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="mt-4 px-4 py-2 text-sm bg-gray-100 text-gray-600 border border-gray-300 rounded-md hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
    >
      Resetear Contadores
    </button>
  );
}
