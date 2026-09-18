// ============================================================
// Cookies anti-duplicado
// ------------------------------------------------------------
// Evitan contar dos veces el mismo celular sin necesidad de una página intermedia:
// el propio endpoint deja la cookie al responder y la reenvía el navegador si el
// alumno vuelve a escanear. Es lo que permite que "Encuestas Pendientes" llegue a
// cero de verdad.
//
// El nombre incluye la GENERACIÓN de la sesión, que sube con cada RESET. Así el
// reset invalida al instante todas las cookies repartidas (que viven en los
// teléfonos y no se pueden borrar desde el servidor): el mismo celular vuelve a
// contar en el salón siguiente.
//
// La caducidad (2 horas) es sólo una red de seguridad: cubre de sobra lo que dura
// una visita, así que dentro del salón un alumno que recargue nunca infla el
// contador, por largo que se haga.
// ============================================================

export const DEDUPE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 2;

/** `escaneo_default_g3` — cambia con cada reset para invalidar las cookies viejas. */
export function dedupeCookieName(prefix, sessionId, generacion) {
  return `${prefix}_${sessionId}_g${generacion}`;
}

export function hasCookie(req, name) {
  const raw = req?.headers?.cookie;

  if (!raw) {
    return false;
  }

  return raw.split(';').some((part) => part.trim().startsWith(`${name}=`));
}

export function buildCookie(name, maxAgeSeconds = DEDUPE_COOKIE_MAX_AGE_SECONDS) {
  return `${name}=1; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax; Secure`;
}
