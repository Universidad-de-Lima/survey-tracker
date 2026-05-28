import { useSurveyCounts } from '@/features/dashboard/hooks/useSurveyCounts';
import { DashboardPanel } from '@/features/dashboard/components/DashboardPanel';
import { QRCodeSection } from '@/features/dashboard/components/QRCodeSection';

export function DashboardPage() {
  const { data: counts, isLoading, isError, error } = useSurveyCounts();

  return (
    <>
      <DashboardPanel counts={counts ?? null} isLoading={isLoading} />

      {isError && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative w-full max-w-lg"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">
            {error?.message ?? 'No se pudieron cargar los datos del backend.'}
          </span>
        </div>
      )}

      <QRCodeSection />
    </>
  );
}
