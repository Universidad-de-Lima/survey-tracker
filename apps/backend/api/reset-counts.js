import { getFirebaseDb } from '../lib/firebase.js';
import { applyCors, resolveSessionId, sessionBase, toCounts } from '../lib/sessions.js';

const db = getFirebaseDb();

/**
 * El botón RESET del panel proyectado.
 *
 * Sin clave a propósito: del toque accidental protege la confirmación de la propia
 * pantalla, y el riesgo que queda (que alguien encuentre la URL) sólo descuadraría un
 * número en pantalla — las respuestas están a salvo en Zoho y se ve al instante.
 */
export default async (req, res) => {
  applyCors(res, { methods: 'POST, OPTIONS' });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const sessionId = resolveSessionId(req);

  try {
    const snapshot = await db.ref(sessionBase(sessionId)).once('value');
    const previousCounts = toCounts(snapshot.val());

    // Un solo `set` sobre el nodo de la sesión: deja los contadores a cero y la
    // sesión lista para el siguiente salón.
    await db.ref(sessionBase(sessionId)).set({
      scanned: 0,
      completed: 0,
    });

    console.log(`Contadores reseteados en ${sessionId}.`, previousCounts);
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
