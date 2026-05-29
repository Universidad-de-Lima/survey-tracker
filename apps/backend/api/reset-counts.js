// api/reset-counts.js (Reset counters via Vercel serverless)
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        try {
            // Read current values before reset
            const snapshot = await db.ref('survey_counts').once('value');
            const previousCounts = snapshot.val() || { scanned: 0, completed: 0 };

            // Reset to zero
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
    } else {
        res.status(405).json({ error: 'Método no permitido.' });
    }
};
