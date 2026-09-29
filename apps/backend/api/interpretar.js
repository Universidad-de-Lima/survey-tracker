// ============================================================
// Interpretación de preguntas del portal (item 1.9)
// ------------------------------------------------------------
// POST { pregunta, contexto, menu } → devuelve SOLO el formulario lleno:
//     { se_puede, operacion, periodo, filtros, pregunta_objetivo,
//       valores_objetivo, entidad, orden, motivo }
//
// Esta función NO responde preguntas ni calcula nada: elige nombres del menú
// (las preguntas y opciones publicadas) y el portal valida contra los JSON y
// responde. Así la IA nunca puede inventar una cifra: no escribe números.
//
// Usa la misma llave de NVIDIA que el proceso del ETL (NVIDIA_API_KEY en Vercel).
// ============================================================

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Cadena de modelos: si uno falla o no responde bien, se prueba el siguiente.
const MODELOS = [
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'z-ai/glm-5.3-flash',
  'poolside/laguna-xs-2.1',
];

const OPERACIONES = [
  'contar', 'porcentaje', 'cruce', 'nps', 'satisfaccion', 'carreras', 'facultades', 'ciclos',
  'dimensiones', 'comentarios', 'temas', 'comparacion', 'fechas', 'periodos', 'ninguna',
];

const MAX_PREGUNTA = 300;
const MAX_CONTEXTO = 6000;
const MAX_MENU = 16000;
const MAX_TOKENS = 500;

// Si un modelo se queda colgado, no se le espera para siempre: se pasa al siguiente.
// (Es configurable para poder probar el corte sin esperar de verdad.)
const TIMEOUT_MS = Number(process.env.INTERPRETAR_TIMEOUT_MS) || 90000;

const INSTRUCCIONES = `Eres el asistente de datos del portal de encuestas de la Universidad de Lima.
Recibes el contexto del proyecto, el menú del período (cada pregunta con sus opciones) y una pregunta.
Respondes SOLO un objeto JSON, sin texto alrededor, con esta forma exacta:
{"se_puede":true,"operacion":"...","periodo":"...","filtros":[{"pregunta":"...","valores":["..."]}],"pregunta_objetivo":"...","valores_objetivo":["..."],"entidad":"...","orden":"...","motivo":""}

- "se_puede" es false cuando la pregunta no se puede responder con los datos del menú (la hora, el clima, otro tema). En ese caso "motivo" lo explica en una frase corta.
- "operacion" es una de: ${OPERACIONES.join(' | ')}.
  - contar o porcentaje: cuántas respuestas cumplen los filtros (cuántos alumnos de tal carrera).
  - cruce: filtrar por una o más condiciones y contar una pregunta objetivo con sus valores (cuántos de tal grupo están satisfechos).
  - nps, satisfaccion, carreras, facultades, ciclos, dimensiones, comentarios, temas, comparacion, fechas, periodos: como se usan hoy.
- "periodo": el nombre del período del menú al que te refieres, copiado tal cual; "" si no aplica.
- "filtros": lista de condiciones; cada una es una pregunta del menú con uno o más valores EXACTOS de esa pregunta.
- "pregunta_objetivo": la pregunta del menú que se quiere contar ("" si no se cuenta ninguna).
- "valores_objetivo": los valores EXACTOS que se quieren contar de la pregunta objetivo.
- "entidad": el nombre propio (carrera, facultad, ciclo o dimensión) cuando la operación lo usa; "" si no.
- "orden": "mejor" o "peor" cuando se piden los más altos o los más bajos; "" si no.

Reglas:
- Copia los nombres EXACTOS del menú; nunca inventes preguntas, valores ni períodos que no estén ahí.
- No escribes cifras ni respondes la pregunta: solo llenas el formulario.
- Si el menú no alcanza para responder, "se_puede" es false.`;

function limpiarTexto(valor, max) {
  return String(valor ?? '').trim().slice(0, max);
}

function limpiarOrden(valor) {
  const texto = String(valor ?? '').trim().toLowerCase();
  return texto === 'mejor' || texto === 'peor' ? texto : '';
}

/** Primer objeto JSON balanceado del texto (los modelos suelen agregar comentarios). */
export function primerObjeto(texto) {
  const inicio = String(texto ?? '').indexOf('{');
  if (inicio === -1) return null;
  let nivel = 0;
  for (let i = inicio; i < texto.length; i += 1) {
    if (texto[i] === '{') nivel += 1;
    else if (texto[i] === '}') {
      nivel -= 1;
      if (nivel === 0) {
        try {
          return JSON.parse(texto.slice(inicio, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Deja la respuesta del modelo en el formulario que espera el portal. */
export function normalizarConsulta(crudo) {
  if (!crudo || typeof crudo !== 'object') return null;
  const operacion = String(crudo.operacion ?? '').trim().toLowerCase();
  if (OPERACIONES.indexOf(operacion) === -1) return null;
  const filtros = (Array.isArray(crudo.filtros) ? crudo.filtros : [])
    .slice(0, 4)
    .map((f) => ({
      pregunta: limpiarTexto(f?.pregunta, 80),
      valores: (Array.isArray(f?.valores) ? f.valores : []).slice(0, 12).map((v) => limpiarTexto(v, 80)).filter(Boolean),
    }))
    .filter((f) => f.pregunta && f.valores.length);
  return {
    se_puede: crudo.se_puede !== false,
    operacion,
    periodo: limpiarTexto(crudo.periodo, 40),
    filtros,
    pregunta_objetivo: limpiarTexto(crudo.pregunta_objetivo, 80),
    valores_objetivo: (Array.isArray(crudo.valores_objetivo) ? crudo.valores_objetivo : [])
      .slice(0, 12)
      .map((v) => limpiarTexto(v, 80))
      .filter(Boolean),
    entidad: limpiarTexto(crudo.entidad, 80),
    orden: limpiarOrden(crudo.orden),
    motivo: limpiarTexto(crudo.motivo, 200),
  };
}

/** El mensaje del usuario: contexto + menú + la pregunta, en ese orden. */
export function armarMensaje(pregunta, contexto, menu) {
  return [
    limpiarTexto(contexto, MAX_CONTEXTO),
    limpiarTexto(menu, MAX_MENU),
    '## Pregunta\n' + pregunta,
  ].filter(Boolean).join('\n\n');
}

async function preguntarAlModelo(modelo, pregunta, contexto, menu, llave) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  let respuesta;
  try {
    respuesta = await fetch(NVIDIA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: INSTRUCCIONES },
          { role: 'user', content: armarMensaje(pregunta, contexto, menu) },
        ],
        temperature: 0,
        max_tokens: MAX_TOKENS,
      }),
      signal: control.signal,
    });
  } finally {
    clearTimeout(reloj);
  }

  if (!respuesta.ok) {
    throw new Error(`${modelo}: ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  const contenido = datos?.choices?.[0]?.message?.content ?? '';
  const consulta = normalizarConsulta(primerObjeto(contenido));
  if (!consulta) {
    throw new Error(`${modelo}: respuesta no interpretable`);
  }
  return consulta;
}

async function interpretar(pregunta, contexto, menu) {
  const llave = process.env.NVIDIA_API_KEY;
  if (!llave) {
    throw new Error('Falta la llave NVIDIA_API_KEY en el servidor.');
  }

  let ultimoError = null;
  for (const modelo of MODELOS) {
    try {
      return await preguntarAlModelo(modelo, pregunta, contexto, menu, llave);
    } catch (error) {
      console.error('Interpretación fallida:', error.message);
      ultimoError = error;
    }
  }
  throw ultimoError ?? new Error('Ningún modelo pudo interpretar la pregunta.');
}

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const cuerpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  const pregunta = String(cuerpo.pregunta ?? '').trim().slice(0, MAX_PREGUNTA);

  if (pregunta.length < 3) {
    res.status(400).json({ error: 'Falta la pregunta.' });
    return;
  }

  try {
    const consulta = await interpretar(pregunta, cuerpo.contexto, cuerpo.menu);
    res.status(200).json({ consulta });
  } catch (error) {
    console.error('Error al interpretar la pregunta del portal:', error);
    res.status(502).json({ error: 'No se pudo interpretar la pregunta.' });
  }
};
