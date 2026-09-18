import { buildCookie, dedupeCookieName, hasCookie } from '../lib/cookies.js';
import { getFirebaseDb, incrementBy } from '../lib/firebase.js';
import {
  applyCors,
  readSessionState,
  resolveSessionId,
  sessionScannedRef,
} from '../lib/sessions.js';

const db = getFirebaseDb();

/**
 * Lo llama el QR proyectado.
 *
 * Cuenta el escaneo y redirige a la encuesta. La cookie `escaneo_<sesión>` evita
 * contar dos veces el mismo celular: sin ella, un alumno que reabre el enlace dejaría
 * "Encuestas Pendientes" clavado en 1 y el encuestador no podría irse.
 */
export default async (req, res) => {
  applyCors(res, { methods: 'GET, POST, OPTIONS' });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const sessionId = resolveSessionId(req);

  // El alumno tiene que llegar a la encuesta SIEMPRE, incluso si el conteo falla:
  // lo que se pierde entonces es un escaneo, nunca su respuesta.
  try {
    const { generacion } = await readSessionState(db, sessionId);
    const cookieName = dedupeCookieName('escaneo', sessionId, generacion);

    if (hasCookie(req, cookieName)) {
      console.log(`Escaneo repetido ignorado en ${sessionId} (generación ${generacion}).`);
    } else {
      // Incremento atómico en servidor: sin leer-modificar-escribir ni reintentos.
      await db.ref(sessionScannedRef(sessionId)).set(incrementBy(1));
      res.setHeader('Set-Cookie', buildCookie(cookieName));
      console.log(`Escaneo contado en ${sessionId} (generación ${generacion}).`);
    }
  } catch (error) {
    console.error('Error al contar el escaneo (se redirige igual a la encuesta):', error);
  }

  res.writeHead(302, {
    Location: process.env.ZOHO_SURVEY_URL,
  });
  res.end();
};
