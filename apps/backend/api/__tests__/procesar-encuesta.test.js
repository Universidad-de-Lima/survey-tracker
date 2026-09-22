import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRes } from '../../test/helpers.js';

let fetchMock;

// El endpoint llama a `fetch` en tiempo de ejecución: basta con reemplazarlo en
// globalThis antes de cada caso.
globalThis.fetch = (...args) => fetchMock(...args);

const { default: procesarEncuesta } = await import('../procesar-encuesta.js');

const ORIGEN = 'https://universidad-de-lima.github.io';

function respuestaGitHub({ status = 204, cuerpo = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
    text: async () => (cuerpo ? JSON.stringify(cuerpo) : ''),
  };
}

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
  process.env.GITHUB_DISPATCH_TOKEN = 'token-de-prueba';
});

afterEach(() => {
  delete process.env.GITHUB_DISPATCH_TOKEN;
});

describe('POST /api/procesar-encuesta', () => {
  it('dispara el evento cuando no hay ejecuciones recientes', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaGitHub({ status: 200, cuerpo: { workflow_runs: [] } }))
      .mockResolvedValueOnce(respuestaGitHub({ status: 204 }));

    const res = createRes();
    await procesarEncuesta({ method: 'POST', headers: { origin: ORIGEN } }, res);

    expect(res.statusCode).toBe(202);
    expect(res.body.message).toContain('Proceso solicitado');

    const [url, opciones] = fetchMock.mock.calls[1];
    expect(url).toBe('https://api.github.com/repos/Universidad-de-Lima/survey-test/dispatches');
    expect(opciones.method).toBe('POST');
    expect(opciones.headers.Authorization).toBe('Bearer token-de-prueba');
    expect(JSON.parse(opciones.body)).toEqual({ event_type: 'procesar_datos' });
  });

  it('no dispara si la última ejecución es reciente', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaGitHub({
        status: 200,
        cuerpo: { workflow_runs: [{ created_at: new Date().toISOString(), status: 'in_progress' }] },
      }),
    );

    const res = createRes();
    await procesarEncuesta({ method: 'POST', headers: { origin: ORIGEN } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('Ya hay una ejecución');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dispara igual cuando el flujo no tiene ejecuciones registradas', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaGitHub({ status: 200, cuerpo: {} }))
      .mockResolvedValueOnce(respuestaGitHub({ status: 204 }));

    const res = createRes();
    await procesarEncuesta({ method: 'POST', headers: { origin: ORIGEN } }, res);

    expect(res.statusCode).toBe(202);
  });

  it('responde 503 si falta la llave en el entorno', async () => {
    delete process.env.GITHUB_DISPATCH_TOKEN;

    const res = createRes();
    await procesarEncuesta({ method: 'POST', headers: { origin: ORIGEN } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.error).toContain('GITHUB_DISPATCH_TOKEN');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('responde 502 si GitHub rechaza la solicitud', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaGitHub({ status: 200, cuerpo: { workflow_runs: [] } }))
      .mockResolvedValueOnce(respuestaGitHub({ status: 403, cuerpo: { message: 'sin permiso' } }));

    const res = createRes();
    await procesarEncuesta({ method: 'POST', headers: { origin: ORIGEN } }, res);

    expect(res.statusCode).toBe(502);
  });

  it('responde 500 si la red falla', async () => {
    fetchMock.mockRejectedValueOnce(new Error('sin red'));

    const res = createRes();
    await procesarEncuesta({ method: 'POST', headers: { origin: ORIGEN } }, res);

    expect(res.statusCode).toBe(500);
  });

  it('permite el preflight del portal y no expone el origen a otros sitios', async () => {
    const permitido = createRes();
    await procesarEncuesta({ method: 'OPTIONS', headers: { origin: ORIGEN } }, permitido);
    expect(permitido.statusCode).toBe(204);
    expect(permitido.headers['Access-Control-Allow-Origin']).toBe(ORIGEN);

    const ajeno = createRes();
    await procesarEncuesta({ method: 'OPTIONS', headers: { origin: 'https://sitio-ajeno.test' } }, ajeno);
    expect(ajeno.statusCode).toBe(204);
    expect(ajeno.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('responde 405 para métodos distintos de POST y OPTIONS', async () => {
    const res = createRes();
    await procesarEncuesta({ method: 'GET', headers: { origin: ORIGEN } }, res);

    expect(res.statusCode).toBe(405);
  });
});
