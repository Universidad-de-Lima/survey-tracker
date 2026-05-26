// QR/services/webhook.js
// Este archivo es un *ejemplo conceptual* para una función serverless de backend.
// NO se despliega directamente en GitHub Pages. Debe ser desplegado en una plataforma como Vercel, Netlify, AWS Lambda, Google Cloud Functions, etc.

// Para usar Firebase Admin SDK:
// 1. Instala el SDK: `npm install firebase-admin` en tu proyecto serverless.
// 2. Obtén las credenciales de servicio de tu proyecto Firebase (Firebase Console -> Configuración del proyecto -> Cuentas de servicio).
// 3. Almacena las credenciales de forma segura (ej. como variables de entorno o un archivo secreto).

// const admin = require('firebase-admin');
// const serviceAccount = require('../path/to/your/serviceAccountKey.json'); // Ruta a tu archivo de credenciales

// // Inicializa Firebase Admin SDK
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: 'https://YOUR-FIREBASE-PROJECT-ID.firebaseio.com' // Reemplaza con el ID de tu proyecto Firebase
// });

// const db = admin.database();

module.exports = async (req, res) => {
    // Habilitar CORS para que el frontend de GitHub Pages pueda acceder
    res.setHeader('Access-Control-Allow-Origin', '*'); // Permite cualquier origen (ajusta en producción)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        // Manejar preflight request de CORS
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        // Endpoint para el webhook de Zoho Survey (encuestas completadas)
        console.log('Webhook de Zoho recibido en (o redirigido a) esta función serverless:', req.body);
        console.log('La URL que DEBES configurar en Zoho Survey para enviar el webhook es: https://webhook.site/5009a994-7d63-47d5-97ef-a15757728466');

        try {
            // Aquí deberías validar el payload de Zoho si es necesario.
            // Por ejemplo, verificar un secreto del webhook si Zoho lo permite.

            // Ejemplo de cómo actualizar en Firebase Realtime Database:
            // const completedRef = db.ref('survey_counts/completed');
            // await completedRef.transaction((currentCount) => {
            //     return (currentCount || 0) + 1;
            // });
            // console.log('Contador de encuestas completadas actualizado en Firebase.');

            // En un entorno real, usarías la base de datos para persistir el contador.
            // Para este ejemplo conceptual, solo mostramos en consola.
            console.log('Simulando incremento de contador de encuestas completadas.');
            
            res.status(200).json({ message: 'Webhook de Zoho procesado con éxito.' });
        } catch (error) {
            console.error('Error al procesar el webhook de Zoho:', error);
            res.status(500).json({ error: 'Error interno del servidor al procesar el webhook.' });
        }
    } else if (req.method === 'GET') {
        // Endpoint para que el frontend consulte los contadores
        try {
            // Ejemplo de cómo obtener datos de Firebase Realtime Database:
            // const snapshot = await db.ref('survey_counts').once('value');
            // const counts = snapshot.val();

            // Datos de ejemplo. ¡Reemplaza con datos reales de tu base de datos!
            const counts = {
                scanned: 120,    // Este valor debería venir de tu base de datos
                completed: 75    // Este valor debería venir de tu base de datos
            };

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
