import { useState } from 'react';

// El PNG lo genera el despliegue (scripts/generar_qr.py) y apunta al contador, no
// directamente a Zoho: por eso el escaneo se puede contar.
const QR_SRC = `${import.meta.env.BASE_URL}qr/encuesta.png`;

export function QRCodeSection() {
  const [noDisponible, setNoDisponible] = useState(false);

  if (noDisponible) {
    return (
      <section className="w-full max-w-2xl bg-red-50 border-4 border-red-500 rounded-lg p-8 text-center">
        <p className="text-2xl font-bold text-red-700">⚠️ El QR no está disponible</p>
        <p className="mt-2 text-red-700">
          No proyectes esta pantalla así: los alumnos no podrían escanear. Avisa al administrador.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white p-4 rounded-lg shadow-lg flex flex-col items-center">
      <img
        src={QR_SRC}
        alt="Código QR de la encuesta"
        onError={() => setNoDisponible(true)}
        className="w-[min(70vw,460px)] h-auto"
      />
      <p className="mt-2 text-sm sm:text-base text-gray-500">Escanea con la cámara del celular</p>
    </section>
  );
}
