import { buildCookie, hasCookie } from '../lib/cookies.js';
import { getFirebaseDb, incrementBy } from '../lib/firebase.js';
import { resolveSessionId, sessionCompletedRef } from '../lib/sessions.js';

const db = getFirebaseDb();

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
 * Lo llama la página final de la encuesta de Zoho ("Redirigir a nueva página").
 *
 * Sustituye al webhook: se pega esta URL una vez en la configuración de Zoho y no
 * hay que montar cabeceras ni secretos. Si Zoho reenvía `?s=` se respeta; si no,
 * cuenta en la sesión de la campaña (`default`), que es el caso normal.
 */
export default async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const sessionId = resolveSessionId(req);
  const cookieName = `terminado_${sessionId}`;

  // Aunque el conteo falle, el alumno ya terminó: siempre ve el agradecimiento.
  try {
    if (hasCookie(req, cookieName)) {
      console.log(`Finalización repetida ignorada en ${sessionId}.`);
    } else {
      await db.ref(sessionCompletedRef(sessionId)).set(incrementBy(1));
      res.setHeader('Set-Cookie', buildCookie(cookieName));
      console.log(`Finalización contada en ${sessionId}.`);
    }
  } catch (error) {
    console.error('Error al contar la finalización:', error);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).end(thanksPage());
};
