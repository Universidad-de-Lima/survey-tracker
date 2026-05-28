const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}
const db = admin.database();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        console.log('Webhook de Zoho recibido:', req.body);
        try {
            if (req.body && req.body.response_status === 'COMPLETED' && req.body.webhook_event === 'response_completed') {
                const completedRef = db.ref('survey_counts/completed');
                await completedRef.transaction((currentCount) => {
                    return (currentCount || 0) + 1;
                });
                console.log('Contador de encuestas completadas actualizado en Firebase.');
                res.status(200).json({ message: 'Webhook de Zoho procesado con éxito.' });
            } else {
                res.status(400).json({ error: 'Payload de webhook inválido o incompleto.' });
            }
        } catch (error) {
            console.error('Error al procesar el webhook de Zoho:', error);
            res.status(500).json({ error: 'Error interno del servidor al procesar el webhook.' });
        }
    } else {
        res.status(405).json({ error: 'Método no permitido.' });
    }
};