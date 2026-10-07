import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyTimer } from '@/features/dashboard/components/SurveyTimer';

const BASE = new Date('2026-10-05T10:00:00Z').getTime();
const DIEZ_DE_LA_MANANA = BASE;

function avanzar(minutos: number) {
  act(() => {
    vi.advanceTimersByTime(minutos * 60 * 1000);
  });
}

describe('SurveyTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DIEZ_DE_LA_MANANA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra 00:00 mientras nadie ha escaneado', () => {
    render(<SurveyTimer firstScanAt={null} lastCompletedAt={null} pending={0} completed={0} />);

    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('avanza en vivo mientras queda alguien respondiendo', () => {
    render(
      <SurveyTimer firstScanAt={BASE} lastCompletedAt={null} pending={3} completed={5} />,
    );

    expect(screen.getByText('00:00')).toBeInTheDocument();

    avanzar(1);

    expect(screen.getByText('01:00')).toBeInTheDocument();
  });

  it('se queda fijo en el tiempo total cuando ya terminaron todos', () => {
    render(
      <SurveyTimer
        firstScanAt={BASE}
        lastCompletedAt={BASE + 21 * 60 * 1000}
        pending={0}
        completed={50}
      />,
    );

    expect(screen.getByText('21:00')).toBeInTheDocument();

    avanzar(10);

    expect(screen.getByText('21:00')).toBeInTheDocument();
  });

  it('pasa a horas cuando el salón se alarga', () => {
    render(
      <SurveyTimer
        firstScanAt={BASE}
        lastCompletedAt={BASE + 3661 * 1000}
        pending={0}
        completed={2}
      />,
    );

    expect(screen.getByText('1:01:01')).toBeInTheDocument();
  });
});
