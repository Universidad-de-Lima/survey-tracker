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

const { default: preguntas, normalizar, limpiarDatosPersonales, claveDe, textoEstaMal } =
  await import('../preguntas.js');

beforeEach(() => {
  vi.clearAllMocks();
  updateMock = vi.fn().mockResolvedValue();
  onceMock = vi.fn().mockResolvedValue({ exists: () => false, val: () => null });
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

  it('no pisa el texto ya guardado cuando llega otra redacción parecida', async () => {
    onceMock.mockResolvedValue({ exists: () => true, val: () => ({ texto: '¿Cuál es el NPS de 2026-1?' }) });
    const res = createRes();

    await preguntas({ method: 'POST', body: { pregunta: 'CUAL ES EL NPS DE 2026 1' } }, res);

    const cambios = updateMock.mock.calls[0][0];
    expect(cambios.texto).toBeUndefined();
    expect(cambios.veces).toEqual({ __increment__: 1 });
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

  it('quita el carácter de reemplazo de un texto que llegó roto', async () => {
    expect(limpiarDatosPersonales('\uFFFDCu\uFFFDl es el NPS?')).toBe('Cul es el NPS?');
  });

  it('reemplaza el texto guardado si quedó todo en mayúsculas', () => {
    expect(textoEstaMal('CUAL ES EL NPS DE 2026 1', 'cuál es el nps de 2026-1')).toBe(true);
    expect(textoEstaMal('cuál es el nps de 2026-1', 'CUAL ES EL NPS')).toBe(false);
    expect(textoEstaMal('\uFFFDCu\uFFFDl es el NPS?', 'cuál es el nps')).toBe(true);
  });

  it('en el POST cambia el texto guardado cuando el viejo quedó en mayúsculas', async () => {
    onceMock.mockResolvedValue({ exists: () => true, val: () => ({ texto: 'CUAL ES EL NPS DE 2026 1' }) });
    const res = createRes();

    await preguntas({ method: 'POST', body: { pregunta: 'cuál es el nps de 2026-1' } }, res);

    expect(updateMock.mock.calls[0][0].texto).toBe('cuál es el nps de 2026-1');
  });

  it('el mantenimiento borra solo las entradas de prueba', async () => {
    onceMock.mockResolvedValue({
      val: () => ({
        a: { texto: 'pregunta real de alguien', intencion: 'NPS' },
        b: { texto: 'CUAL ES EL NPS DE 2026 1', intencion: 'prueba' },
      }),
    });
    const removeMock = vi.fn().mockResolvedValue();
    refMock.mockImplementation(() => ({ update: updateMock, once: onceMock, remove: removeMock }));
    const res = createRes();

    await preguntas({ method: 'POST', body: { limpiar: 'prueba' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.borradas).toBe(1);
    // Borra por la clave guardada en Firebase, no por una recalculada.
    expect(refMock).toHaveBeenCalledWith('preguntas/b');
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
