import { timingSafeEqual } from 'node:crypto';

import { getFirebaseDb, incrementBy } from '../lib/firebase.js';
import {
  applyCors,
  resolveSessionId,
  sessionCompletedRef,
  sessionProcessedRef,
} from '../lib/sessions.js';

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

/**
 * Reserva la respuesta de forma ATÓMICA: la transacción sobre el propio marcador
 * decide un único ganador aunque lleguen dos reintentos de Zoho a la vez. El patrón
 * anterior (consultar y luego escribir) dejaba pasar ambos y contaba doble.
 */
async function claimResponse(sessionId, responseId) {
  const markerRef = db.ref(sessionProcessedRef(sessionId, responseId));

  const result = await markerRef.transaction((current) => {
    if (current) {
      return undefined; // abortar: esta respuesta ya se contó
    }
    return { processedAt: new Date().toISOString() };
  });

  return { committed: Boolean(result?.committed), markerRef };
}

export default async (req, res) => {
  applyCors(res, { methods: 'POST, OPTIONS', headers: 'Content-Type, X-Webhook-Secret' });

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

  const sessionId = resolveSessionId(req);

  try {
    if (!response_id) {
      console.warn('Webhook sin response_id: no se puede garantizar la idempotencia.');
      await db.ref(sessionCompletedRef(sessionId)).set(incrementBy(1));
      res.status(200).json({ message: 'Webhook de Zoho procesado con éxito.', completed: true });
      return;
    }

    const { committed, markerRef } = await claimResponse(sessionId, response_id);

    if (!committed) {
      console.log(`Webhook idempotente: response_id ${response_id} ya fue procesado.`);
      res.status(200).json({ message: 'Webhook ya fue procesado.', completed: false });
      return;
    }

    try {
      await db.ref(sessionCompletedRef(sessionId)).set(incrementBy(1));
    } catch (error) {
      // Liberar la reserva: si no se pudo contar, el reintento de Zoho debe poder hacerlo.
      await markerRef.remove();
      throw error;
    }

    console.log(`Contador de completadas actualizado en la sesión ${sessionId}.`);
    res.status(200).json({ message: 'Webhook de Zoho procesado con éxito.', completed: true });
  } catch (error) {
    console.error('Error al procesar el webhook de Zoho:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar el webhook.' });
  }
};
