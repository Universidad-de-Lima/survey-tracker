import { getFirebaseDb, incrementBy } from '../lib/firebase.js';
import {
  applyCors,
  ensureCurrentSession,
  sessionBase,
  sessionDeviceRef,
  sessionScannedRef,
  toCounts,
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
 * La URL de la encuesta con el salón pegado: Zoho lo guarda como variable
 * personalizada y lo reenvía a /api/done al terminar, así cada finalización
 * se atribuye al salón en el que se escaneó (aunque llegue con retraso).
 */
function zohoUrlFor(sessionId) {
  const url = new URL(process.env.ZOHO_SURVEY_URL);
  url.searchParams.set('s', sessionId);

  return url.toString();
}

/**
 * Un mismo celular cuenta un solo escaneo por salón: recargar la página o volver
 * a escanear el QR no infla el contador, que es lo que rompía el criterio
 * "encuestados pendientes = 0" y dejaba al encuestador esperando para siempre.
 */
async function claimDevice(sessionId, deviceId) {
  const result = await db
    .ref(sessionDeviceRef(sessionId, deviceId))
    .transaction((current) => {
      if (current) {
        return undefined; // abortar: este dispositivo ya se contó en este salón
      }
      return { firstSeenAt: new Date().toISOString() };
    });

  return Boolean(result?.committed);
}

/**
 * Lo llama la página intermedia a la que apunta el QR.
 *
 * Nunca es la única vía para llegar a la encuesta: la página redirige a Zoho
 * pase lo que pase, incluso si esta petición falla.
 */
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

  try {
    const { id: sessionId, created } = await ensureCurrentSession(db);
    const deviceId = deviceIdFrom(req);
    const shouldCount = deviceId ? await claimDevice(sessionId, deviceId) : true;

    if (shouldCount) {
      // Incremento atómico en servidor: sin leer-modificar-escribir y sin reintentos.
      await db.ref(sessionScannedRef(sessionId)).set(incrementBy(1));
      console.log(`Escaneo contado en el salón ${sessionId}.`);
    } else {
      console.log(`Escaneo repetido ignorado (salón ${sessionId}): el celular ya contaba.`);
    }

    const snapshot = await db.ref(sessionBase(sessionId)).once('value');

    res.status(200).json({
      sessionId,
      sessionCreated: created,
      countRegistered: shouldCount,
      url: zohoUrlFor(sessionId),
      ...toCounts(snapshot.val()),
    });
  } catch (error) {
    console.error('Error al registrar el escaneo:', error);
    res.status(500).json({ error: 'Error al registrar el escaneo.' });
  }
};
