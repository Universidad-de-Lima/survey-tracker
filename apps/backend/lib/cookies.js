// ============================================================
// Cookies anti-duplicado
// ------------------------------------------------------------
// Evitan contar dos veces el mismo celular sin necesidad de una página intermedia:
// el propio endpoint deja la cookie al responder y la reenvía el navegador si el
// alumno vuelve a escanear.
//
// Caducan a los 20 minutos A PROPÓSITO:
//   · dentro de una visita (10-15 min) frenan el doble escaneo, que es lo que
//     impedía que "Encuestas Pendientes" llegara a cero;
//   · antes del siguiente salón (30 min después) ya no existen, así que el mismo
//     alumno vuelve a contar en el salón siguiente, como debe ser.
// ============================================================

export const DEDUPE_COOKIE_MAX_AGE_SECONDS = 60 * 20;

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
