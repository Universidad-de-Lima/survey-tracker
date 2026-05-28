import logoSrc from '@/assets/Logo.png';

export function Header() {
  return (
    <header className="bg-white shadow-md py-4 px-6 flex items-center justify-between flex-wrap">
      <div className="flex items-center">
        <img src={logoSrc} alt="Logo de la Universidad" className="h-20 mr-4" />
      </div>
      <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mt-2 md:mt-0 text-center flex-grow">
        ENCUESTA DE SATISFACCIÓN PREGRADO 2026-1
      </h2>
    </header>
  );
}
