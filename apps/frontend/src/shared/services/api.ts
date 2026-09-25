import { envConfig } from '@/shared/validators/env';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * El backend responde en español con `{ error: "..." }`. El panel se proyecta en clase, así
 * que nunca debe mostrar un texto técnico en inglés: si el cuerpo no se puede leer, se usa un
 * mensaje llano con el número del error.
 */
async function mensajeDeError(response: Response): Promise<string> {
  try {
    const cuerpo = (await response.json()) as { error?: unknown } | null;

    if (cuerpo && typeof cuerpo.error === 'string' && cuerpo.error.trim() !== '') {
      return cuerpo.error;
    }
  } catch {
    // Respuesta sin cuerpo legible (por ejemplo, un error de la propia plataforma).
  }

  return `El servidor respondió con un error (código ${response.status}).`;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${envConfig.VITE_API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await mensajeDeError(response));
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint);
  },

  post<T>(endpoint: string, body: unknown, extraOptions?: RequestInit): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...extraOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(extraOptions?.headers as Record<string, string>),
      },
    });
  },
};

export { ApiError };
