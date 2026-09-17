import { getFirebaseDb, incrementBy } from '../lib/firebase.js';
import {
  applyCors,
  resolveSessionId,
  sessionDeviceRef,
  sessionScannedRef,
} from '../lib/sessions.js';

const db = getFirebaseDb();

function deviceIdFrom(req) {
  const raw = req?.query?.d ?? req?.body?.deviceId;
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === undefined || value === null || String(value).trim() === ''
    ? null
    : String(value).trim();
}

/**
 * Un mismo dispositivo cuenta un solo escaneo por sesión: recargar la página o
 * volver a escanear el QR no infla el contador, que es lo que rompía el criterio
 * "encuestados pendientes = 0" para cerrar un salón.
 */
async function claimDevice(sessionId, deviceId) {
  const result = await db
    .ref(sessionDeviceRef(sessionId, deviceId))
    .transaction((current) => {
      if (current) {
        return undefined; // abortar: este dispositivo ya se contó en esta sesión
      }
      return { firstSeenAt: new Date().toISOString() };
    });

  return Boolean(result?.committed);
}

export default async (req, res) => {
  applyCors(res, { methods: 'GET, POST, OPTIONS' });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const sessionId = resolveSessionId(req);
  const deviceId = deviceIdFrom(req);

  try {
    const shouldCount = deviceId ? await claimDevice(sessionId, deviceId) : true;

    if (shouldCount) {
      // Incremento atómico en servidor: sin leer-modificar-escribir y sin reintentos.
      await db.ref(sessionScannedRef(sessionId)).set(incrementBy(1));
      console.log(`Escaneo contado en la sesión ${sessionId}.`);
    } else {
      console.log(`Escaneo repetido ignorado (sesión ${sessionId}): el dispositivo ya contaba.`);
    }

    res.writeHead(302, {
      Location: process.env.ZOHO_SURVEY_URL,
    });
    res.end();
  } catch (error) {
    console.error('Error al procesar QR scan y redirigir:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud de escaneo QR.' });
  }
};
