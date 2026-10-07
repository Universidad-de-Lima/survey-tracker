import logoSrc from '@/assets/Logo.png';
import { SurveyTimer } from '@/features/dashboard/components/SurveyTimer';
import { useSurveyCounts } from '@/features/dashboard/hooks/useSurveyCounts';

export function Header() {
  // El encabezado reutiliza la misma consulta del panel: no genera peticiones extra.
  const { data } = useSurveyCounts();

  return (
    <header className="bg-white shadow-md py-4 px-6 flex items-center justify-between flex-wrap">
      <div className="flex items-center">
        <img src={logoSrc} alt="Logo de la Universidad" className="h-20 mr-4" />
      </div>
      <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mt-2 md:mt-0 text-center flex-grow">
        ENCUESTA DE SATISFACCIÓN PREGRADO 2026-2
      </h2>
      <SurveyTimer
        firstScanAt={data?.firstScanAt ?? null}
        lastCompletedAt={data?.lastCompletedAt ?? null}
        pending={data?.pending ?? 0}
        completed={data?.completed ?? 0}
      />
    </header>
  );
}
