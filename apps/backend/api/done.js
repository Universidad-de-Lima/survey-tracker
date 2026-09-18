import { getFirebaseDb, incrementBy } from '../lib/firebase.js';
import { queryParam, sessionCompletedRef } from '../lib/sessions.js';

const db = getFirebaseDb();

// 2 horas: el tiempo que puede tardar un alumno en volver, y muy por encima de lo
// que dura una visita. Evita contar dos veces la misma finalización si el alumno
// recarga la página de agradecimiento.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 2;

function cookieName(sessionId) {
  return `encuesta_${sessionId}`;
}

function hasCookie(req, name) {
  const raw = req?.headers?.cookie;

  if (!raw) {
    return false;
  }

  return raw.split(';').some((part) => part.trim().startsWith(`${name}=`));
}

function thanksPage() {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Encuesta registrada</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; background: #0b1020; color: #eef2ff;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { text-align: center; padding: 2rem; max-width: 26rem; }
  .tick { font-size: 3.5rem; line-height: 1; }
  h1 { font-size: 1.5rem; margin: 1rem 0 0.75rem; }
  p { margin: 0; color: #a9b4d0; line-height: 1.6; }
</style>
</head>
<body>
<main>
  <div class="tick">✅</div>
  <h1>¡Gracias! Tu encuesta quedó registrada</h1>
  <p>Ya puedes cerrar esta ventana y entregar el celular.</p>
</main>
</body>
</html>`;
}

/**
 * Lo llama la página final de la encuesta de Zoho ("Redirigir a nueva página"),
 * que reenvía el parámetro `s` que viajó en la URL del alumno.
 *
 * Sustituye al webhook: no hay que configurar cabeceras ni secretos en Zoho.
 */
export default async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const rawSession = queryParam(req, 's');
  const sessionId =
    rawSession === undefined || rawSession === null || String(rawSession).trim() === ''
      ? null
      : String(rawSession).trim();

  // Sin `s` no se cuenta: es preferible perder una finalización a ensuciar el
  // contador de otro salón (por ejemplo, la sesión heredada `default`).
  if (!sessionId) {
    console.warn('Llegó una finalización sin el parámetro `s`: no se cuenta.');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).end(thanksPage());
    return;
  }

  try {
    const name = cookieName(sessionId);

    if (hasCookie(req, name)) {
      console.log(`Finalización repetida ignorada en el salón ${sessionId}.`);
    } else {
      await db.ref(sessionCompletedRef(sessionId)).set(incrementBy(1));
      console.log(`Finalización contada en el salón ${sessionId}.`);
      res.setHeader(
        'Set-Cookie',
        `${name}=1; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; Secure`,
      );
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).end(thanksPage());
  } catch (error) {
    console.error('Error al registrar la finalización:', error);
    // El alumno ya terminó: aunque falle el conteo, la página de agradecimiento
    // se muestra igual.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).end(thanksPage());
  }
};
