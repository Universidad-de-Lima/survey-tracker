import { getFirebaseDb } from '../lib/firebase.js';
import { applyCors, resolveSessionId, sessionBase, toCounts } from '../lib/sessions.js';

const db = getFirebaseDb();

export default async (req, res) => {
  applyCors(res, { methods: 'GET, OPTIONS' });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const sessionId = resolveSessionId(req);

  try {
    const snapshot = await db.ref(sessionBase(sessionId)).once('value');
    const counts = toCounts(snapshot.val());

    res.status(200).json({ ...counts, sessionId });
  } catch (error) {
    console.error('Error al obtener los contadores para el frontend:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener los contadores.' });
  }
};
