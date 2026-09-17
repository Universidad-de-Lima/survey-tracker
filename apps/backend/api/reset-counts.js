import { timingSafeEqual } from 'node:crypto';

import { getFirebaseDb } from '../lib/firebase.js';
import { applyCors, resolveSessionId, sessionBase, toCounts } from '../lib/sessions.js';

const db = getFirebaseDb();

// Comparación en tiempo constante: `!==` filtra el secreto byte a byte según el tiempo
// de respuesta. `timingSafeEqual` exige buffers de la misma longitud, por eso se
// comprueba el tamaño antes de comparar.
function secretsMatch(provided, expected) {
  const providedBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(String(expected));

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export default async (req, res) => {
  applyCors(res, { methods: 'POST, OPTIONS', headers: 'Content-Type, X-Reset-Secret' });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  // Falla CERRADO: sin secreto configurado el endpoint queda deshabilitado en lugar de
  // abrirse. Es una operación destructiva, así que la ausencia de configuración nunca
  // debe convertirse en acceso libre.
  const expectedSecret = process.env.RESET_COUNTS_SECRET;

  if (!expectedSecret) {
    console.error(
      'RESET_COUNTS_SECRET no está configurado: el endpoint de reset queda deshabilitado.',
    );
    res.status(503).json({ error: 'Reset endpoint not configured.' });
    return;
  }

  if (!secretsMatch(req.headers['x-reset-secret'], expectedSecret)) {
    console.warn('Reset rechazado: secreto inválido o ausente.');
    res.status(401).json({ error: 'Unauthorized: invalid reset secret.' });
    return;
  }

  const sessionId = resolveSessionId(req);

  try {
    const snapshot = await db.ref(sessionBase(sessionId)).once('value');
    const previousCounts = toCounts(snapshot.val());

    // Un solo `set` sobre el nodo de la sesión: además de poner los contadores a cero,
    // borra los dispositivos y las respuestas ya vistas, de modo que una sesión
    // reiniciada vuelve a contar desde el principio.
    await db.ref(sessionBase(sessionId)).set({
      scanned: 0,
      completed: 0,
    });

    console.log(`Contadores reseteados en la sesión ${sessionId}.`, previousCounts);
    res.status(200).json({
      message: 'Contadores reseteados exitosamente.',
      sessionId,
      previousCounts: {
        scanned: previousCounts.scanned,
        completed: previousCounts.completed,
      },
    });
  } catch (error) {
    console.error('Error al resetear contadores:', error);
    res.status(500).json({ error: 'Error interno del servidor al resetear contadores.' });
  }
};
