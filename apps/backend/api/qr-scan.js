import { getFirebaseDb, incrementBy, serverTimestamp } from '../lib/firebase.js';
import {
  applyCors,
  resolveSessionId,
  sessionFirstScanRef,
  sessionScannedRef,
} from '../lib/sessions.js';

const db = getFirebaseDb();

/** Lo llama el QR proyectado: cuenta el escaneo y redirige a la encuesta. */
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
    // Incremento atómico en servidor: sin leer-modificar-escribir ni reintentos.
    await db.ref(sessionScannedRef(sessionId)).set(incrementBy(1));
    console.log(`Escaneo contado en ${sessionId}.`);
  } catch (error) {
    console.error('Error al contar el escaneo (se redirige igual a la encuesta):', error);
  }

  // El cronómetro del panel arranca con el primer escaneo del salón. Se escribe una sola
  // vez (si ya hay marca, no se toca): el conteo no depende de ella, así que si falla solo
  // se pierde la marca, nunca el escaneo ni la respuesta del alumno.
  try {
    const marca = db.ref(sessionFirstScanRef(sessionId));
    const actual = await marca.once('value');

    if (!actual.exists() || !actual.val()) {
      await marca.set(serverTimestamp());
    }
  } catch (error) {
    console.error('Error al marcar el primer escaneo (el conteo sigue igual):', error);
  }

  res.writeHead(302, {
    Location: process.env.ZOHO_SURVEY_URL,
  });
  res.end();
};
