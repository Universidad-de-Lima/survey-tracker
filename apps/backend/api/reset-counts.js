import { timingSafeEqual } from 'node:crypto';

import { getFirebaseDb } from '../lib/firebase.js';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Reset-Secret');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  // Falla CERRADO: sin secreto configurado el endpoint queda deshabilitado en lugar de
  // abrirse a cualquiera. Es una operación destructiva, así que la ausencia de
  // configuración nunca debe convertirse en acceso libre.
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

  try {
    const snapshot = await db.ref('survey_counts').once('value');
    const previousCounts = snapshot.val() || { scanned: 0, completed: 0 };

    await db.ref('survey_counts').set({
      scanned: 0,
      completed: 0,
    });

    console.log('Contadores reseteados. Valores anteriores:', previousCounts);
    res.status(200).json({
      message: 'Contadores reseteados exitosamente.',
      previousCounts: {
        scanned: previousCounts.scanned ?? 0,
        completed: previousCounts.completed ?? 0,
      },
    });
  } catch (error) {
    console.error('Error al resetear contadores:', error);
    res.status(500).json({ error: 'Error interno del servidor al resetear contadores.' });
  }
};
