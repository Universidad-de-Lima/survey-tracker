import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRes } from '../../test/helpers.js';

let fetchMock;

globalThis.fetch = (...args) => fetchMock(...args);

const { default: interpretar, primerObjeto, normalizarConsulta } = await import('../interpretar.js');

/** Respuesta del modelo con un contenido dado. */
function modelo(contenido, { status = 200 } = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content: contenido } }] }),
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
  process.env.NVIDIA_API_KEY = 'llave-de-prueba';
});

describe('traducción de la pregunta', () => {
  it('saca el objeto JSON aunque venga con texto alrededor', () => {
    const crudo = primerObjeto('Claro:\n{"dato":"nps","periodo":"2026-1"}\nEspero que ayude.');

    expect(crudo).toEqual({ dato: 'nps', periodo: '2026-1' });
  });

  it('solo acepta los datos de la lista y limpia el resto', () => {
    expect(normalizarConsulta({ dato: 'NPS', periodo: ' 2026-1 ', entidad: ' Psicología ', orden: 'PEOR' }))
      .toEqual({ dato: 'nps', periodo: '2026-1', entidad: 'Psicología', orden: 'peor' });
    expect(normalizarConsulta({ dato: 'inventado' })).toBeNull();
    expect(normalizarConsulta(null)).toBeNull();
  });

  it('no deja pasar períodos ni órdenes que no correspondan', () => {
    const consulta = normalizarConsulta({ dato: 'nps', periodo: 'el año pasado', orden: 'el peor' });

    expect(consulta.periodo).toBe('');
    expect(consulta.orden).toBe('');
  });

  it('devuelve la consulta cuando el modelo responde bien', async () => {
    fetchMock.mockReturnValue(modelo('{"dato":"satisfaccion","periodo":"2026-1","entidad":"Psicología","orden":""}'));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Qué tan satisfechos están en Psicología?' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta).toEqual({ dato: 'satisfaccion', periodo: '2026-1', entidad: 'Psicología', orden: '' });
    expect(fetchMock.mock.calls[0][0]).toContain('integrate.api.nvidia.com');
  });

  it('marca "ninguna" cuando la pregunta no es de las encuestas', async () => {
    fetchMock.mockReturnValue(modelo('{"dato":"ninguna","periodo":"","entidad":"","orden":""}'));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Qué hora es?' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.dato).toBe('ninguna');
  });

  it('si el primer modelo falla, prueba el siguiente', async () => {
    fetchMock
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 503, json: async () => ({}) }))
      .mockReturnValueOnce(modelo('{"dato":"respuestas","periodo":"2026","entidad":"","orden":""}'));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuántos alumnos se encuestaron en 2026?' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.dato).toBe('respuestas');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('si ningún modelo responde, avisa sin romper', async () => {
    fetchMock.mockReturnValue(modelo('no es json', { status: 200 }));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuántos fueron?' } }, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBeTruthy();
  });

  it('sin llave configurada avisa en vez de intentar', async () => {
    delete process.env.NVIDIA_API_KEY;
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuál es el NPS?' } }, res);

    expect(res.statusCode).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza los métodos que no corresponden', async () => {
    const res = createRes();

    await interpretar({ method: 'GET' }, res);

    expect(res.statusCode).toBe(405);
  });
});
