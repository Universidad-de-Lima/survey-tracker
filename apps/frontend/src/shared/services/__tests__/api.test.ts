import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@/shared/services/api';

/** Respuesta mínima de `fetch`, con cuerpo opcional. */
function respuesta(status: number, cuerpo?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (cuerpo === undefined) {
        throw new SyntaxError('sin cuerpo legible');
      }
      return cuerpo;
    },
  };
}

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa el mensaje en español que envía el backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuesta(500, { error: 'Error interno del servidor.' })),
    );

    await expect(apiClient.get('/get-counts')).rejects.toThrow('Error interno del servidor.');
  });

  it('no muestra textos técnicos en inglés cuando el cuerpo no se puede leer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(502)));

    const error = await apiClient.get('/get-counts').catch((fallo: unknown) => fallo);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(
      'El servidor respondió con un error (código 502).',
    );
    expect((error as ApiError).message).not.toContain('HTTP error');
  });
});
