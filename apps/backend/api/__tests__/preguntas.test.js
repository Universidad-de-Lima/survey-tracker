import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRes } from '../../test/helpers.js';

let updateMock;
let onceMock;
let refMock;

// El endpoint captura la instancia de Firebase durante la importación, así que
// `dbStore.current` debe existir ya aquí (nunca null).
globalThis.dbStore = {
  current: {
    ref: (...args) => refMock(...args),
  },
};

vi.doMock('../../lib/firebase.js', () => ({
  getFirebaseDb: () => globalThis.dbStore.current,
  incrementBy: (amount) => ({ __increment__: amount }),
}));

const { default: preguntas, normalizar, limpiarDatosPersonales, claveDe } = await import('../preguntas.js');

beforeEach(() => {
  vi.clearAllMocks();
  updateMock = vi.fn().mockResolvedValue();
  onceMock = vi.fn().mockResolvedValue({ val: () => ({}) });
  refMock = vi.fn(() => ({ update: updateMock, once: onceMock }));
});

describe('registro de preguntas del portal', () => {
  it('guarda la pregunta y suma 1 en su contador', async () => {
    const res = createRes();

    await preguntas({ method: 'POST', body: { pregunta: '¿Cuál es el NPS de 2026-1?', intencion: 'NPS' } }, res);

    expect(res.statusCode).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ veces: { __increment__: 1 }, intencion: 'NPS' })
    );
    expect(refMock.mock.calls[0][0]).toMatch(/^preguntas\//);
  });

  it('las preguntas parecidas caen en la misma clave y suman juntas', async () => {
    const una = claveDe(normalizar('¿Cuál es el NPS de 2026-1?'));
    const otra = claveDe(normalizar('cual es el nps de 2026-1'));

    expect(otra).toBe(una);
  });

  it('quita correos y números antes de guardar', async () => {
    const limpio = limpiarDatosPersonales(
      'mi correo es juan.perez@ulima.edu.pe y mi telefono 987654321, ¿cuál es el NPS?'
    );

    expect(limpio).not.toContain('ulima.edu.pe');
    expect(limpio).not.toContain('987654321');
    expect(limpio).toContain('[correo]');
    expect(limpio).toContain('[numero]');
  });

  it('no guarda una pregunta vacía o sin sentido', async () => {
    const res = createRes();

    await preguntas({ method: 'POST', body: { pregunta: '  ' } }, res);

    expect(res.statusCode).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('devuelve las más frecuentes ordenadas de mayor a menor', async () => {
    onceMock.mockResolvedValue({
      val: () => ({
        a: { texto: 'poco', veces: 2 },
        b: { texto: 'mucho', veces: 9 },
        c: { texto: 'medio', veces: 5 },
      }),
    });
    const res = createRes();

    await preguntas({ method: 'GET' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.frecuentes.map((x) => x.texto)).toEqual(['mucho', 'medio', 'poco']);
    expect(res.body.frecuentes[0].veces).toBe(9);
  });

  it('responde al preflight de CORS del portal', async () => {
    const res = createRes();

    await preguntas({ method: 'OPTIONS' }, res);

    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('rechaza los métodos que no corresponden', async () => {
    const res = createRes();

    await preguntas({ method: 'DELETE' }, res);

    expect(res.statusCode).toBe(405);
  });
});
