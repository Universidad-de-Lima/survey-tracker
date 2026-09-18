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
 * Sin sesión explícita devuelve `default`.
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

// ============================================================
// Ciclo de vida del salón
// ------------------------------------------------------------
//   sesion_actual              id del salón ABIERTO (o ausente si no hay ninguno)
//   sessions/<id>/inicio       marca del PRIMER escaneo
//   sessions/<id>/fin          marca del botón "cerrar salón" (ausente = abierta)
//
// El id es la etiqueta del contador, NO un dato de la encuesta: no se le pide al
// alumno, no se muestra y no forma parte de las respuestas. Se genera solo.
// ============================================================

export const CURRENT_SESSION_REF = 'sesion_actual';
const CAMPAIGN_TIME_ZONE = 'America/Lima';

/**
 * Genera `salon_2026-09-20_11-00` en hora de Lima.
 *
 * Al derivarse del minuto, dos escaneos simultáneos del primer salón producen el
 * MISMO id: aunque lleguen a la vez, no se crean dos sesiones distintas.
 */
export function newSessionId(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CAMPAIGN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return `salon_${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}`;
}

export function sessionStateRef() {
  return CURRENT_SESSION_REF;
}

export function sessionStartRef(sessionId) {
  return `${sessionBase(sessionId)}/inicio`;
}

export function sessionEndRef(sessionId) {
  return `${sessionBase(sessionId)}/fin`;
}

/** Una sesión con `fin` está cerrada: ya no admite escaneos ni finalizaciones. */
export function toSessionEntry(sessionId, value) {
  const counts = toCounts(value);

  return {
    id: sessionId,
    inicio: value?.inicio ?? null,
    fin: value?.fin ?? null,
    abierta: !value?.fin,
    ...counts,
  };
}

/**
 * Devuelve el id del salón abierto y lo crea si todavía no existe.
 *
 * Lo crea el PRIMER ESCANEO: el encuestador no pulsa nada para empezar. Si el
 * puntero está vacío, se escribe y se vuelve a leer, de modo que si dos escaneos
 * entran a la vez ambos acaban contando en la misma sesión.
 */
export async function ensureCurrentSession(db, now = new Date()) {
  const stateRef = db.ref(CURRENT_SESSION_REF);
  const current = (await stateRef.once('value')).val();

  if (current) {
    return { id: String(current), created: false };
  }

  const proposed = newSessionId(now);
  await stateRef.set(proposed);
  await db.ref(sessionStartRef(proposed)).set(now.toISOString());

  const confirmed = (await stateRef.once('value')).val();

  return { id: String(confirmed ?? proposed), created: true };
}
