// api/get-counts.js (Este es para el backend serverless en Vercel)
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

module.exports = async (req, res) => {
    // Habilitar CORS para que el frontend de GitHub Pages pueda acceder
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method === 'GET') {
        try {
            const snapshot = await db.ref('survey_counts').once('value');
            const counts = snapshot.val() || { scanned: 0, completed: 0 }; // Valores por defecto si no hay datos
            console.log('Contadores enviados al frontend:', counts);
            res.status(200).json(counts);
        } catch (error) {
            console.error('Error al obtener los contadores para el frontend:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los contadores.' });
        }
    } else {
        res.status(405).json({ error: 'Método no permitido.' });
    }
};
