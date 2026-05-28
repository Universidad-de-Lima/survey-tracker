import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DashboardCard } from '@/features/dashboard/components/DashboardCard';

describe('DashboardCard', () => {
  it('renders label and value', () => {
    render(<DashboardCard label="Test Label" value={42} color="blue" />);

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
