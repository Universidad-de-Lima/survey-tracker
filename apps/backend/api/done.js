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
  .marca { display: block; width: 105px; height: 105px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 1rem 0 0.75rem; }
  p { margin: 0; color: #a9b4d0; line-height: 1.6; }
</style>
</head>
<body>
<main>
  <img class="marca" src="data:image/png;base64,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" alt="" width="105" height="105" />
  <h1>¡Gracias! Tu encuesta quedó registrada</h1>
  <p>Ya puedes cerrar esta ventana.</p>
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

  // Aunque el conteo falle, el alumno ya terminó: siempre ve el agradecimiento.
  try {
    await db.ref(sessionCompletedRef(sessionId)).set(incrementBy(1));
    console.log(`Finalización contada en ${sessionId}.`);
  } catch (error) {
    console.error('Error al contar la finalización:', error);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).end(thanksPage());
};
