import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRes } from '../../test/helpers.js';

let fetchMock;

globalThis.fetch = (...args) => fetchMock(...args);

const {
  default: interpretar, primerObjeto, normalizarConsulta, armarMensaje,
} = await import('../interpretar.js');

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

describe('formulario de la pregunta (contexto + menú)', () => {
  it('saca el objeto JSON aunque venga con texto alrededor', () => {
    const crudo = primerObjeto('Claro:\n{"se_puede":true,"operacion":"nps"}\nEspero que ayude.');

    expect(crudo).toEqual({ se_puede: true, operacion: 'nps' });
  });

  it('arma el mensaje con contexto, menú y pregunta, en ese orden', () => {
    const mensaje = armarMensaje('¿Cuántos fueron?', '## Qué es\n- Portal', '## Menú — X\n- Carrera');

    expect(mensaje.indexOf('## Qué es')).toBeLessThan(mensaje.indexOf('## Menú'));
    expect(mensaje.indexOf('## Menú')).toBeLessThan(mensaje.indexOf('## Pregunta'));
    expect(mensaje).toContain('¿Cuántos fueron?');
  });

  it('solo acepta las operaciones de la lista y limpia el resto', () => {
    const f = normalizarConsulta({
      se_puede: true,
      operacion: 'NPS',
      periodo: ' Graduados Pregrado 2026 ',
      filtros: [{ pregunta: ' Carrera ', valores: [' Economía ', ''] }],
      pregunta_objetivo: ' Situación laboral ',
      valores_objetivo: [' Trabajador dependiente '],
      entidad: ' Psicología ',
      orden: 'PEOR',
      motivo: '',
    });

    expect(f).toEqual({
      se_puede: true,
      operacion: 'nps',
      periodo: 'Graduados Pregrado 2026',
      filtros: [{ pregunta: 'Carrera', valores: ['Economía'] }],
      pregunta_objetivo: 'Situación laboral',
      valores_objetivo: ['Trabajador dependiente'],
      entidad: 'Psicología',
      orden: 'peor',
      motivo: '',
    });
    expect(normalizarConsulta({ operacion: 'inventada' })).toBeNull();
    expect(normalizarConsulta(null)).toBeNull();
  });

  it('no deja pasar órdenes que no correspondan ni filtros vacíos', () => {
    const f = normalizarConsulta({ operacion: 'nps', orden: 'el peor', filtros: [{ pregunta: '', valores: [] }] });

    expect(f.orden).toBe('');
    expect(f.filtros).toEqual([]);
  });

  it('devuelve el formulario cuando el modelo responde bien, con contexto y menú en el envío', async () => {
    fetchMock.mockReturnValue(modelo(JSON.stringify({
      se_puede: true,
      operacion: 'porcentaje',
      periodo: 'Graduados Pregrado 2026',
      filtros: [{ pregunta: 'Carrera', valores: ['Economía'] }],
      pregunta_objetivo: 'Situación laboral',
      valores_objetivo: ['Trabajador dependiente'],
      entidad: '',
      orden: '',
      motivo: '',
    })));
    const res = createRes();

    await interpretar({
      method: 'POST',
      body: { pregunta: '¿Cuántos trabajan?', contexto: '## Qué es\n- Portal', menu: '## Menú — X\n- Situación laboral' },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.operacion).toBe('porcentaje');
    expect(res.body.consulta.filtros).toEqual([{ pregunta: 'Carrera', valores: ['Economía'] }]);
    const enviado = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(enviado.max_tokens).toBeGreaterThanOrEqual(400);
    expect(enviado.messages[1].content).toContain('## Qué es');
    expect(enviado.messages[1].content).toContain('## Menú');
  });

  it('marca "se_puede" false cuando la pregunta no es de las encuestas', async () => {
    fetchMock.mockReturnValue(modelo('{"se_puede":false,"operacion":"ninguna","motivo":"No es de las encuestas."}'));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Qué hora es?' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.se_puede).toBe(false);
    expect(res.body.consulta.motivo).toContain('encuestas');
  });

  it('si el primer modelo falla, prueba el siguiente', async () => {
    fetchMock
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 503, json: async () => ({}) }))
      .mockReturnValueOnce(modelo('{"se_puede":true,"operacion":"nps","periodo":"2026-1"}'));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuál es el NPS?' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.operacion).toBe('nps');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('si un modelo se queda colgado, se corta y prueba el siguiente', async () => {
    process.env.INTERPRETAR_TIMEOUT_MS = '30';
    let primera = true;
    fetchMock.mockImplementation(() => {
      if (primera) {
        primera = false;
        return new Promise((ok, mal) => {
          const t = setTimeout(() => mal(Object.assign(new Error('abortado'), { name: 'AbortError' })), 20);
          void t; void ok;
        });
      }
      return modelo('{"se_puede":true,"operacion":"nps","periodo":"2026-1"}');
    });
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuál es el NPS?' } }, res);
    delete process.env.INTERPRETAR_TIMEOUT_MS;

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.operacion).toBe('nps');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].signal).toBeTruthy();
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
