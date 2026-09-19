import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QRCodeSection } from '@/features/dashboard/components/QRCodeSection';

describe('QRCodeSection', () => {
  it('muestra el QR que genera el despliegue', () => {
    render(<QRCodeSection />);

    const qr = screen.getByAltText('Código QR de la Encuesta');

    expect(qr).toBeInTheDocument();
    expect(qr.getAttribute('src')).toContain('qr/encuesta.png');
  });
});
