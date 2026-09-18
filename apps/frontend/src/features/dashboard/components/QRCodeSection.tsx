// El PNG lo genera el despliegue (scripts/generar_qr.py) y apunta al contador, no
// directamente a Zoho: por eso el escaneo se puede contar.
const QR_SRC = `${import.meta.env.BASE_URL}qr/encuesta.png`;

export function QRCodeSection() {
  return (
    <section className="flex flex-col items-center bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">
      <img
        src={QR_SRC}
        alt="Código QR de la Encuesta"
        className="w-full h-auto object-contain mb-0"
      />
    </section>
  );
}
