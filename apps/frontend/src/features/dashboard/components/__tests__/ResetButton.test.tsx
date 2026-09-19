import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResetButton } from '@/features/dashboard/components/ResetButton';
import { resetSurveyCounts } from '@/features/dashboard/services/dashboardService';

vi.mock('@/features/dashboard/services/dashboardService', () => ({
  fetchSurveyCounts: vi.fn(),
  resetSurveyCounts: vi.fn(),
}));

function renderResetButton() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ResetButton />
    </QueryClientProvider>,
  );
}

describe('ResetButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resetSurveyCounts).mockResolvedValue({
      message: 'Contadores reseteados exitosamente.',
      previousCounts: { scanned: 30, completed: 28 },
    });
  });

  it('pide confirmación antes de resetear', () => {
    renderResetButton();

    fireEvent.click(screen.getByText('Resetear Contadores'));

    expect(screen.getByText(/¿Resetear todos los contadores a cero\?/)).toBeInTheDocument();
    expect(resetSurveyCounts).not.toHaveBeenCalled();
  });

  it('resetea cuando se confirma', async () => {
    renderResetButton();

    fireEvent.click(screen.getByText('Resetear Contadores'));
    fireEvent.click(screen.getByText('Sí, resetear'));

    await waitFor(() => expect(resetSurveyCounts).toHaveBeenCalledTimes(1));
  });

  it('vuelve atrás sin resetear cuando se cancela', () => {
    renderResetButton();

    fireEvent.click(screen.getByText('Resetear Contadores'));
    fireEvent.click(screen.getByText('Cancelar'));

    expect(resetSurveyCounts).not.toHaveBeenCalled();
    expect(screen.getByText('Resetear Contadores')).toBeInTheDocument();
  });
});
