import { DashboardCard } from './DashboardCard';

import type { DashboardCounts } from '@/features/dashboard/types';

interface DashboardPanelProps {
  counts: DashboardCounts | null;
  isLoading: boolean;
}

export function DashboardPanel({ counts, isLoading }: DashboardPanelProps) {
  if (isLoading && !counts) {
    return (
      <aside className="w-full flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-300 text-white p-4 rounded-lg shadow-xl flex-1 max-w-xs animate-pulse"
          >
            <div className="h-10 w-16 mx-auto bg-gray-400 rounded mb-2" />
            <div className="h-4 w-24 mx-auto bg-gray-400 rounded" />
          </div>
        ))}
      </aside>
    );
  }

  const scanned = counts?.scanned ?? 0;
  const completed = counts?.completed ?? 0;
  const pending = counts?.pending ?? 0;

  return (
    <>
      <aside className="w-full flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
        <DashboardCard label="Escaneos Totales" value={scanned} color="blue" />
        <DashboardCard label="Encuestas Completadas" value={completed} color="green" />
        <DashboardCard label="Encuestados Pendientes" value={pending} color="orange" />
      </aside>
    </>
  );
}
