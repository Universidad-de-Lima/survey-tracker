// ============================================================
// Contador de cupo del intérprete del portal (ítem 1.9)
// ------------------------------------------------------------
// Cuenta SOLO las preguntas que se envían a Google, que son las que gastan cupo
// (plan gratuito: 15 por minuto y 500 por día, por proyecto). Google reinicia el
// cupo a medianoche de la hora del Pacífico, así que el día y el minuto se
// calculan en esa zona.
//
// Estructura en Firebase RTDB (prefijo "cuota/"):
//   cuota/minuto/<YYYY-MM-DD HH:MM>   -> preguntas de ese minuto
//   cuota/dia/<YYYY-MM-DD>            -> preguntas de ese día
//
// No se guarda nada más: ni el texto de la pregunta ni quién preguntó.
// ============================================================

import { getFirebaseDb, incrementBy } from './firebase.js';

const REF = 'cuota';

/** Límites del plan gratuito (configurables por si cambian). */
export const LIMITE_MINUTO = Number(process.env.INTERPRETAR_RPM_LIMITE) || 15;
export const LIMITE_DIA = Number(process.env.INTERPRETAR_RPD_LIMITE) || 500;

/** Día y minuto en la hora del Pacífico (donde Google reinicia el cupo). */
export function clavesDeTiempo(ahora = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(ahora).reduce((acc, x) => { acc[x.type] = x.value; return acc; }, {});
  const dia = `${p.year}-${p.month}-${p.day}`;
  return { dia, minuto: `${dia} ${p.hour}:${p.minute}` };
}

/** Suma una pregunta al minuto y al día. Nunca lanza: si falla, se ignora. */
export async function contarPregunta(ahora = new Date()) {
  try {
    const { dia, minuto } = clavesDeTiempo(ahora);
    const db = getFirebaseDb();
    await Promise.all([
      db.ref(`${REF}/minuto/${minuto}`).set(incrementBy(1)),
      db.ref(`${REF}/dia/${dia}`).set(incrementBy(1)),
    ]);
  } catch (error) {
    console.error('No se pudo contar la pregunta para el cupo:', error.message);
  }
}

/** Lee el uso de este minuto y de hoy. Si falla, devuelve ceros. */
export async function leerCupo(ahora = new Date()) {
  const { dia, minuto } = clavesDeTiempo(ahora);
  try {
    const db = getFirebaseDb();
    const [m, d] = await Promise.all([
      db.ref(`${REF}/minuto/${minuto}`).once('value'),
      db.ref(`${REF}/dia/${dia}`).once('value'),
    ]);
    return { usadoMinuto: Number(m.val() || 0), usadoDia: Number(d.val() || 0) };
  } catch (error) {
    console.error('No se pudo leer el cupo:', error.message);
    return { usadoMinuto: 0, usadoDia: 0 };
  }
}

/** Limpieza: borra las claves de minuto de días anteriores (se llama poco). */
export async function podarMinutosViejos(ahora = new Date()) {
  try {
    const { dia } = clavesDeTiempo(ahora);
    const db = getFirebaseDb();
    const snapshot = await db.ref(`${REF}/minuto`).orderByKey().endAt(dia).once('value');
    const borrar = {};
    snapshot.forEach((hijo) => { borrar[hijo.key] = null; });
    if (Object.keys(borrar).length) await db.ref(`${REF}/minuto`).update(borrar);
  } catch (error) {
    console.error('No se pudo podar el contador de minutos:', error.message);
  }
}
