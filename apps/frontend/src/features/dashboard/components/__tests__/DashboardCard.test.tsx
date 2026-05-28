import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardCard } from '@/features/dashboard/components/DashboardCard';

// Mock requestAnimationFrame to execute callback immediately
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

describe('DashboardCard', () => {
  it('renders label and value', () => {
    render(<DashboardCard label="Test Label" value={42} color="blue" />);
    vi.advanceTimersByTime(1000);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('applies correct color class for blue', () => {
    const { container } = render(<DashboardCard label="Blue" value={0} color="blue" />);
    expect(container.firstChild).toHaveClass('bg-blue-600');
  });

  it('applies correct color class for green', () => {
    const { container } = render(<DashboardCard label="Green" value={0} color="green" />);
    expect(container.firstChild).toHaveClass('bg-green-600');
  });

  it('applies correct color class for orange', () => {
    const { container } = render(<DashboardCard label="Orange" value={0} color="orange" />);
    expect(container.firstChild).toHaveClass('bg-orange-600');
  });
});
