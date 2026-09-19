import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPanel } from '@/features/dashboard/components/DashboardPanel';

// Los números se animan con requestAnimationFrame; el mismo apaño que en
// DashboardCard.test.tsx: se ejecuta el callback al momento para ver el valor final.
beforeEach(() => {
  vi.useFakeTimers();
  const mockRaf = (cb: FrameRequestCallback) => {
    cb(Date.now());
    return 0;
  };
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(mockRaf);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DashboardPanel', () => {
  it('muestra los tres contadores con los valores que recibe', () => {
    render(<DashboardPanel counts={{ scanned: 30, completed: 28, pending: 2 }} isLoading={false} />);
    vi.advanceTimersByTime(1000);

    expect(screen.getByText('Escaneos Totales')).toBeInTheDocument();
    expect(screen.getByText('Encuestas Completadas')).toBeInTheDocument();
    expect(screen.getByText('Encuestados Pendientes')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('muestra esqueletos mientras carga la primera vez', () => {
    render(<DashboardPanel counts={null} isLoading />);

    expect(screen.queryByText('Escaneos Totales')).not.toBeInTheDocument();
  });

  it('muestra ceros cuando todavía no hay contadores', () => {
    render(<DashboardPanel counts={null} isLoading={false} />);
    vi.advanceTimersByTime(1000);

    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});
