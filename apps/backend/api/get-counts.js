const { getFirebaseDb } = require('../lib/firebase');

const db = getFirebaseDb();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  try {
    const snapshot = await db.ref('survey_counts').once('value');
    const counts = snapshot.val() || { scanned: 0, completed: 0 };
    console.log('Contadores enviados al frontend:', counts);
    res.status(200).json(counts);
  } catch (error) {
    console.error('Error al obtener los contadores para el frontend:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener los contadores.' });
  }
};
