// ============================================================
// Sesiones de encuesta
// ------------------------------------------------------------
// Cada salón encuestado estrena su propia sesión, de forma que los contadores
// nunca se mezclan entre salones y NO hace falta reiniciar nada entre uno y otro.
// Una sesión se crea sola con el primer escaneo que llega con su id: no hay que
// dar de alta nada por adelantado.
//
// Estructura en Firebase RTDB:
//   sessions/<sessionId>/scanned             contador de escaneos
//   sessions/<sessionId>/completed           contador de encuestas terminadas
//   sessions/<sessionId>/devices/<deviceId>  dedupe de escaneos por dispositivo
//   sessions/<sessionId>/processed/<respId>  dedupe de completadas
//
// Sin `?s=<id>` se usa la sesión `default`, que es la que usaban los QR anteriores
// a este cambio: el comportamiento previo se mantiene intacto.
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

function queryValue(req, name) {
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
 * Sin sesión explícita devuelve `default`.
 */
export function resolveSessionId(req) {
  const raw =
    queryValue(req, 's') ?? queryValue(req, 'session') ?? req?.body?.session ?? req?.body?.sesion;

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

export function sessionDeviceRef(sessionId, deviceId) {
  return `${sessionBase(sessionId)}/devices/${sanitizeKey(deviceId).slice(0, 64)}`;
}

export function sessionProcessedRef(sessionId, responseId) {
  return `${sessionBase(sessionId)}/processed/${sanitizeKey(responseId).slice(0, 128)}`;
}

/** Cabeceras CORS compartidas: el dashboard se sirve desde GitHub Pages. */
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
