// ============================================================
// Sesiones de encuesta
// ------------------------------------------------------------
// Estructura en Firebase RTDB:
//   sessions/<sessionId>/scanned    contador de escaneos
//   sessions/<sessionId>/completed  contador de encuestas terminadas
//
// La campaña usa UNA sola sesión (`default`): se escanea, se pulsa RESET y se pasa
// al siguiente salón. El soporte de `?s=<id>` se mantiene porque los QR ya impresos
// lo llevan; sin `?s=` se cuenta siempre en `default`.
// ============================================================

export const DEFAULT_SESSION = 'default';
export const SESSIONS_REF = 'sessions';

/** Firebase RTDB prohíbe `.`, `#`, `$`, `[`, `]` y `/` en las claves. */
export function sanitizeKey(key) {
  return String(key)
    .replace(/\./g, '_')
    .replace(/#/g, '_')
    .replace(/\$/g, '_')
    .replace(/\[/g, '_')
    .replace(/\]/g, '_')
    .replace(/\//g, '_');
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Lee un parámetro de la query, venga en `req.query` o sólo dentro de `req.url`
 * (Zoho redirige con la URL completa y no siempre hay `req.query`).
 */
export function queryParam(req, name) {
  const direct = firstValue(req?.query?.[name]);
  if (direct !== undefined && direct !== null) {
    return direct;
  }

  try {
    const url = new URL(req?.url ?? '/', 'http://localhost');
    return url.searchParams.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resuelve el id de sesión desde la query (`?s=`) o el cuerpo (`session`/`sesion`).
 * Sin sesión explícita devuelve `default`, que es la sesión de la campaña.
 */
export function resolveSessionId(req) {
  const raw =
    queryParam(req, 's') ?? queryParam(req, 'session') ?? req?.body?.session ?? req?.body?.sesion;

  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULT_SESSION;
  }

  return sanitizeKey(String(raw).trim()).slice(0, 64);
}

export function sessionBase(sessionId) {
  return `${SESSIONS_REF}/${sessionId}`;
}

export function sessionScannedRef(sessionId) {
  return `${sessionBase(sessionId)}/scanned`;
}

export function sessionCompletedRef(sessionId) {
  return `${sessionBase(sessionId)}/completed`;
}

/** Cabeceras CORS compartidas: el panel se sirve desde GitHub Pages. */
export function applyCors(res, { methods = 'GET, OPTIONS', headers = 'Content-Type' } = {}) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
}

/**
 * Normaliza lo que devuelve un GET de RTDB a un objeto de contadores.
 * `Number(...) || 0` explícito: si sólo existe `scanned`, `pending` no puede salir NaN.
 */
export function toCounts(value) {
  const scanned = Number(value?.scanned) || 0;
  const completed = Number(value?.completed) || 0;

  return { scanned, completed, pending: Math.max(0, scanned - completed) };
}

/**
 * Generación de la sesión: sube en 1 con cada RESET.
 *
 * Sirve para invalidar al instante las cookies que ya están repartidas por los
 * teléfonos: el RESET no puede borrarlas (viven en el navegador del alumno), así que
 * en su lugar cambia el nombre de la cookie. Sin esto, el mismo celular que vuelve a
 * escanear después de un reset no se contaría hasta que su cookie caducara.
 */
export function sessionGenerationRef(sessionId) {
  return `${sessionBase(sessionId)}/generacion`;
}

/**
 * Lee de una sola consulta el estado completo de la sesión: la generación (para el
 * nombre de la cookie) y los contadores. Una lectura, no dos.
 */
export async function readSessionState(db, sessionId) {
  const value = (await db.ref(sessionBase(sessionId)).once('value')).val();

  return {
    generacion: Number(value?.generacion) || 0,
    counts: toCounts(value),
  };
}
