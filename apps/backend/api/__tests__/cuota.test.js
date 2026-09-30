import { describe, expect, it, vi } from 'vitest';

import { createRes } from '../../test/helpers.js';

vi.mock('../../lib/cuota.js', () => ({
  leerCupo: vi.fn(async () => ({ usadoMinuto: 3, usadoDia: 27 })),
  LIMITE_MINUTO: 15,
  LIMITE_DIA: 500,
}));

const { default: cuota } = await import('../cuota.js');

describe('cupo del intérprete (endpoint)', () => {
  it('devuelve el uso y los límites', async () => {
    const res = createRes();

    await cuota({ method: 'GET' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ usadoMinuto: 3, limiteMinuto: 15, usadoDia: 27, limiteDia: 500 });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('responde 204 al sondeo del navegador', async () => {
    const res = createRes();

    await cuota({ method: 'OPTIONS' }, res);

    expect(res.statusCode).toBe(204);
  });

  it('rechaza los métodos que no corresponden', async () => {
    const res = createRes();

    await cuota({ method: 'POST' }, res);

    expect(res.statusCode).toBe(405);
  });
});
