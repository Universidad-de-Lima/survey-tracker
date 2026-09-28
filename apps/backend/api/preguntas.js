// ============================================================
// Preguntas frecuentes del asistente del portal (item 1.9)
// ------------------------------------------------------------
// Estructura en Firebase RTDB:
//   preguntas/<clave>   { texto, veces, ultima, intencion }
//
// La clave es el texto normalizado (minúsculas, sin tildes ni signos), así que
// "¿Cuál es el NPS de 2026-1?" y "NPS 2026-1" caen en la misma clave y suman.
//
// POST { pregunta, intencion? } → guarda/suma la pregunta.
// GET                            → devuelve las más frecuentes (máximo 12).
//
// Antes de guardar se quitan correos, teléfonos y números largos: la pregunta
// viaja tal cual la escribió la persona y puede traer un dato personal sin querer.
// ============================================================

import { getFirebaseDb, incrementBy } from '../lib/firebase.js';
import { applyCors } from '../lib/sessions.js';

const db = getFirebaseDb();

const REF = 'preguntas';
const MAX_LARGO = 160;
const TOP = 12;

/**
 * Deja la pregunta lista para comparar: minúsculas, sin tildes, sin signos
 * y con un solo espacio entre palabras.
 */
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LARGO);
}

/**
 * Quita lo que parezca un dato personal: correos, números de teléfono y
 * cadenas largas de dígitos (documentos, códigos de alumno).
 */
export function limpiarDatosPersonales(texto) {
  return String(texto ?? '')
    .replace(/\uFFFD/g, '')            // caracter de reemplazo: el texto llegó roto
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]')
    .replace(/\+?\d[\d\s().-]{5,}\d/g, '[numero]')
    .replace(/\d{6,}/g, '[numero]')
    .slice(0, MAX_LARGO)
    .trim();
}

/** Clave segura para Firebase (sin `.`, `#`, `$`, `[`, `]`, `/`). */
export function claveDe(normalizada) {
  return Buffer.from(normalizada, 'utf8').toString('base64url').slice(0, 120);
}

/**
 * El texto guardado se reemplaza solo si quedo peor que el nuevo: si trae caracteres
 * rotos o si esta todo en mayusculas y el nuevo no. Asi la lista se ve ordenada.
 */
export function textoEstaMal(previo, nuevo) {
  const viejo = String(previo ?? '');
  const flamante = String(nuevo ?? '');
  if (!flamante) return false;
  if (/\uFFFD/.test(viejo)) return true;
  const enMayusculas = (x) => x === x.toUpperCase() && x !== x.toLowerCase();
  return enMayusculas(viejo) && !enMayusculas(flamante);
}

/** Mantenimiento: borra las entradas de prueba (las que se registraron con intencion "prueba"). */
async function limpiarDePrueba() {
  const snapshot = await db.ref(REF).once('value');
  const datos = snapshot.val() ?? {};
  const borradas = Object.keys(datos).filter((clave) => datos[clave] && datos[clave].intencion === 'prueba');
  await Promise.all(borradas.map((clave) => db.ref(`${REF}/${clave}`).remove()));
  return borradas.length;
}

async function guardar(pregunta, intencion) {
  const limpia = limpiarDatosPersonales(pregunta);
  const normalizada = normalizar(limpia);
  if (normalizada.length < 4) {
    return null;
  }

  const clave = claveDe(normalizada);
  const nodo = db.ref(`${REF}/${clave}`);

  // Se guarda la PRIMERA redacción que llegó: si luego alguien pregunta lo mismo
  // en mayúsculas o sin signos, suma en `veces` pero no pisa el texto ya guardado.
  const previo = await nodo.once('value');
  const textoPrevio = previo.exists() && previo.val() && previo.val().texto;

  const cambios = {
    veces: incrementBy(1),
    ultima: Date.now(),
    intencion: String(intencion ?? '').slice(0, 40),
  };
  if (!textoPrevio || textoEstaMal(textoPrevio, limpia)) {
    cambios.texto = limpia;
  }

  await nodo.update(cambios);
  return clave;
}

async function frecuentes() {
  const snapshot = await db.ref(REF).once('value');
  const datos = snapshot.val() ?? {};
  return Object.values(datos)
    .filter((x) => x && x.texto && Number(x.veces) > 0)
    .sort((a, b) => Number(b.veces) - Number(a.veces))
    .slice(0, TOP)
    .map((x) => ({ texto: x.texto, veces: Number(x.veces), intencion: x.intencion ?? '' }));
}

export default async (req, res) => {
  applyCors(res, { methods: 'GET, POST, OPTIONS' });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      res.status(200).json({ frecuentes: await frecuentes() });
      return;
    }

    if (req.method === 'POST') {
      const cuerpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});

      if (cuerpo.limpiar === 'prueba') {
        res.status(200).json({ ok: true, borradas: await limpiarDePrueba() });
        return;
      }
      const clave = await guardar(cuerpo.pregunta, cuerpo.intencion);

      if (!clave) {
        res.status(400).json({ error: 'La pregunta está vacía.' });
        return;
      }

      res.status(200).json({ ok: true, clave });
      return;
    }

    res.status(405).json({ error: 'Método no permitido.' });
  } catch (error) {
    console.error('Error en el registro de preguntas del portal:', error);
    res.status(500).json({ error: 'Error interno del servidor al registrar la pregunta.' });
  }
};
