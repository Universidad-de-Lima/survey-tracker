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
    const value = snapshot.val();
    const previousCounts = toCounts(value);

    // El reset sube la generación: eso invalida al instante las cookies repartidas
    // (que viven en los teléfonos y no se pueden borrar desde aquí), de modo que el
    // mismo celular vuelve a contar en el salón siguiente.
    const generacion = (Number(value?.generacion) || 0) + 1;

    // Un solo `set` sobre el nodo de la sesión: deja los contadores a cero y la
    // sesión lista para el siguiente salón.
    await db.ref(sessionBase(sessionId)).set({
      scanned: 0,
      completed: 0,
      generacion,
    });

    console.log(`Contadores reseteados en ${sessionId} (generación ${generacion}).`, previousCounts);
    res.status(200).json({
      message: 'Contadores reseteados exitosamente.',
      sessionId,
      generacion,
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
