import { timingSafeEqual } from 'node:crypto';

import { getFirebaseDb } from '../lib/firebase.js';

const db = getFirebaseDb();

const SURVEY_COUNTS_REF = 'survey_counts';
const PROCESSED_RESPONSES_REF = 'processed_responses';

function sanitizeKey(key) {
  return String(key)
    .replace(/\./g, '_')
    .replace(/#/g, '_')
    .replace(/\$/g, '_')
    .replace(/\[/g, '_')
    .replace(/\]/g, '_')
    .replace(/\//g, '_');
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  // Falla CERRADO: sin secreto configurado el webhook queda deshabilitado en lugar de
  // aceptar cualquier petición. El contador de completadas es un dato de negocio, así
  // que la ausencia de configuración no debe convertirse en acceso libre.
  const expectedSecret = process.env.ZOHO_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.error('ZOHO_WEBHOOK_SECRET no está configurado: el webhook queda deshabilitado.');
    res.status(503).json({ error: 'Webhook secret not configured.' });
    return;
  }

  if (!secretsMatch(req.headers['x-webhook-secret'], expectedSecret)) {
    console.warn('Webhook rechazado: secreto inválido.');
    res.status(401).json({ error: 'Unauthorized: invalid webhook secret.' });
    return;
  }

  console.log('Webhook de Zoho recibido:', req.body);

  const { response_status, webhook_event, response_id } = req.body || {};

  if (response_status !== 'COMPLETED' || webhook_event !== 'response_completed') {
    res.status(400).json({ error: 'Payload de webhook inválido o incompleto.' });
    return;
  }

  try {
    if (response_id) {
      const safeResponseId = sanitizeKey(response_id);
      const processedRef = db.ref(`${PROCESSED_RESPONSES_REF}/${safeResponseId}`);
      const processedSnap = await processedRef.once('value');

      if (processedSnap.exists()) {
        console.log(`Webhook idempotente: response_id ${response_id} ya fue procesado.`);
        res.status(200).json({ message: 'Webhook ya fue procesado.', completed: false });
        return;
      }
    }

    const completedRef = db.ref(`${SURVEY_COUNTS_REF}/completed`);
    await completedRef.transaction((currentCount) => {
      return (currentCount || 0) + 1;
    });

    if (response_id) {
      const safeResponseId = sanitizeKey(response_id);
      const processedRef = db.ref(`${PROCESSED_RESPONSES_REF}/${safeResponseId}`);
      await processedRef.set({
        processedAt: new Date().toISOString(),
      });
    }

    console.log('Contador de encuestas completadas actualizado en Firebase.');
    res.status(200).json({ message: 'Webhook de Zoho procesado con éxito.', completed: true });
  } catch (error) {
    console.error('Error al procesar el webhook de Zoho:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar el webhook.' });
  }
};
