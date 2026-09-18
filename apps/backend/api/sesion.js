import { timingSafeEqual } from 'node:crypto';

import { getFirebaseDb } from '../lib/firebase.js';
import {
  CURRENT_SESSION_REF,
  applyCors,
  sessionBase,
  sessionEndRef,
  toSessionEntry,
} from '../lib/sessions.js';

const db = getFirebaseDb();

// Comparación en tiempo constante: `!==` filtra el secreto byte a byte según el
// tiempo de respuesta. `timingSafeEqual` exige buffers de la misma longitud.
function secretsMatch(provided, expected) {
  const providedBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(String(expected));

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

async function currentSessionId() {
  const value = (await db.ref(CURRENT_SESSION_REF).once('value')).val();

  return value ? String(value) : null;
}

async function listSessions() {
  const value = (await db.ref('sessions').once('value')).val();

  if (!value || typeof value !== 'object') {
    return [];
  }

  // El id (`salon_AAAA-MM-DD_HH-mm`) ordena cronológicamente por sí solo: el más
  // reciente es el primero.
  return Object.keys(value)
    .sort()
    .reverse()
    .map((id) => toSessionEntry(id, value[id]));
}

async function handleGet(res) {
  const [sessionId, history] = await Promise.all([currentSessionId(), listSessions()]);
  const current = history.find((entry) => entry.id === sessionId) ?? null;

  res.status(200).json({ actual: current, historial: history });
}

/** El botón del encuestador: cierra el salón y el siguiente escaneo abre otro. */
async function handleClose(req, res) {
  // Falla CERRADO: cerrar un salón a mitad de campaña es una operación sensible,
  // así que sin secreto configurado el endpoint queda deshabilitado.
  const expectedSecret = process.env.RESET_COUNTS_SECRET;

  if (!expectedSecret) {
    console.error('RESET_COUNTS_SECRET no está configurado: no se puede cerrar el salón.');
    res.status(503).json({ error: 'Reset endpoint not configured.' });
    return;
  }

  if (!secretsMatch(req.headers['x-reset-secret'], expectedSecret)) {
    console.warn('Cierre de salón rechazado: secreto inválido o ausente.');
    res.status(401).json({ error: 'Unauthorized: invalid reset secret.' });
    return;
  }

  const sessionId = await currentSessionId();

  if (!sessionId) {
    res.status(409).json({ error: 'No hay ningún salón abierto.' });
    return;
  }

  const snapshot = await db.ref(sessionBase(sessionId)).once('value');
  const closed = toSessionEntry(sessionId, snapshot.val());
  const now = new Date().toISOString();

  await db.ref(sessionEndRef(sessionId)).set(now);
  await db.ref(CURRENT_SESSION_REF).remove();

  console.log(`Salón ${sessionId} cerrado.`, closed);

  res.status(200).json({
    message: 'Salón cerrado. El siguiente escaneo abre uno nuevo.',
    sesion: { ...closed, fin: now, abierta: false },
  });
}

export default async (req, res) => {
  applyCors(res, { methods: 'GET, POST, OPTIONS', headers: 'Content-Type, X-Reset-Secret' });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      await handleGet(res);
      return;
    }

    if (req.method === 'POST') {
      await handleClose(req, res);
      return;
    }

    res.status(405).json({ error: 'Método no permitido.' });
  } catch (error) {
    console.error('Error al gestionar la sesión de encuesta:', error);
    res.status(500).json({ error: 'Error interno del servidor al gestionar la sesión.' });
  }
};
