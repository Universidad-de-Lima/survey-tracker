import { QRCodeSection } from '@/features/dashboard/components/QRCodeSection';
import { ResetButton } from '@/features/dashboard/components/ResetButton';
import { useSurveyCounts } from '@/features/dashboard/hooks/useSurveyCounts';

interface ContadorProps {
  label: string;
  value: number;
  destacado?: boolean;
}

function Contador({ label, value, destacado = false }: ContadorProps) {
  return (
    <div
      className={`bg-white rounded-lg shadow-lg px-4 py-6 text-center border-b-8 ${
        destacado ? 'border-green-500' : 'border-gray-300'
      }`}
    >
      <p className="text-6xl sm:text-8xl font-black tabular-nums leading-none text-gray-900">
        {value}
      </p>
      <p className="mt-3 text-lg sm:text-2xl font-semibold uppercase tracking-wide text-gray-600">
        {label}
      </p>
    </div>
  );
}

/**
 * La pantalla que se proyecta en el salón: el QR, los tres números en grande y el
 * botón de reset. Se lee desde las últimas filas y no hace falta desplazarse.
 */
export function DashboardPage() {
  const { data, isLoading, isError, error } = useSurveyCounts();

  const scanned = data?.scanned ?? 0;
  const completed = data?.completed ?? 0;
  const pending = data?.pending ?? 0;
  const cargando = isLoading && !data;
  const todosTerminaron = !cargando && !isError && scanned > 0 && pending === 0;

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <QRCodeSection />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-5xl">
        <Contador label="Escanearon" value={scanned} />
        <Contador label="Terminaron" value={completed} />
        <Contador label="Pendientes" value={pending} destacado={pending === 0 && scanned > 0} />
      </section>

      {todosTerminaron && (
        <p className="text-2xl sm:text-4xl font-bold text-green-700 text-center" role="status">
          ✅ Todos terminaron: resetea y pasa al siguiente salón
        </p>
      )}

      {isError && (
        <div
          className="w-full max-w-3xl bg-red-100 border-4 border-red-500 text-red-800 px-4 py-3 rounded"
          role="alert"
        >
          <p className="text-lg font-bold">Sin conexión con el contador</p>
          <p className="text-sm">
            Puede que estos números no estén al día. Los alumnos igual llegan a la encuesta.{' '}
            {error?.message ?? ''}
          </p>
        </div>
      )}

      <div className="w-full max-w-3xl">
        <ResetButton />
      </div>
    </div>
  );
}
