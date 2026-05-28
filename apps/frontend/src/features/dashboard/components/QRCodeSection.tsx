import qrCodeSrc from '@/assets/QRCode.png';

export function QRCodeSection() {
  return (
    <section className="flex flex-col items-center bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">
      <img
        src={qrCodeSrc}
        alt="Código QR de la Encuesta"
        className="w-full h-auto object-contain mb-0"
      />
    </section>
  );
}
