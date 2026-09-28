// ============================================================
// Interpretación de preguntas del portal (item 1.9)
// ------------------------------------------------------------
// POST { pregunta } → devuelve SOLO la consulta:
//     { dato, periodo, entidad, orden }
//
// Esta función NO responde preguntas ni calcula nada: traduce la frase a una consulta
// ordenada. El portal toma esa consulta y responde con el motor de datos, que lee los
// JSON publicados. Así la IA nunca puede inventar una cifra: no escribe números.
//
// Usa la misma llave de NVIDIA que el proceso del ETL (variable NVIDIA_API_KEY en Vercel).
// ============================================================

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Cadena de modelos: si uno falla o no responde bien, se prueba el siguiente.
const MODELOS = [
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'z-ai/glm-5.3-flash',
  'poolside/laguna-xs-2.1',
];

const DATOS = [
  'nps', 'satisfaccion', 'respuestas', 'carreras', 'facultades', 'ciclos',
  'dimensiones', 'comentarios', 'temas', 'comparacion', 'fechas', 'periodos', 'ninguna',
];

const INSTRUCCIONES = `Traduces preguntas al español sobre encuestas de satisfacción a una consulta ordenada.
Respondes SOLO un objeto JSON, sin texto alrededor, con esta forma exacta:
{"dato":"...","periodo":"...","entidad":"...","orden":"..."}

"dato" es uno de: ${DATOS.join(' | ')}.
"periodo" es el período o año que se menciona (por ejemplo "2026-1", "2025-2", "2026"); si no se menciona ninguno, "".
"entidad" es el nombre propio que aparezca en la pregunta (carrera, facultad, ciclo o dimensión), copiado tal cual; si no hay, "".
"orden" es "mejor" o "peor" cuando la pregunta pide los más altos o los más bajos; si no, "".

Reglas:
- Si la pregunta no trata sobre estas encuestas (la hora, el clima, noticias, política, personas), "dato" es "ninguna".
- Nunca inventes períodos ni nombres que no estén en la pregunta.
- No respondes la pregunta, solo la traduces.`;

function limpiarPeriodo(valor) {
  const texto = String(valor ?? '').trim().slice(0, 20);
  return /^(20\d\d)(-\d)?$/.test(texto) ? texto : '';
}

function limpiarEntidad(valor) {
  return String(valor ?? '').trim().slice(0, 80);
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

/** Deja la respuesta del modelo en la consulta que espera el portal. */
export function normalizarConsulta(crudo) {
  if (!crudo || typeof crudo !== 'object') return null;
  const dato = String(crudo.dato ?? '').trim().toLowerCase();
  if (DATOS.indexOf(dato) === -1) return null;
  return {
    dato,
    periodo: limpiarPeriodo(crudo.periodo),
    entidad: limpiarEntidad(crudo.entidad),
    orden: limpiarOrden(crudo.orden),
  };
}

async function preguntarAlModelo(modelo, pregunta, llave) {
  const respuesta = await fetch(NVIDIA_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${llave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: 'system', content: INSTRUCCIONES },
        { role: 'user', content: pregunta },
      ],
      temperature: 0,
      max_tokens: 120,
    }),
  });

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

async function interpretar(pregunta) {
  const llave = process.env.NVIDIA_API_KEY;
  if (!llave) {
    throw new Error('Falta la llave NVIDIA_API_KEY en el servidor.');
  }

  let ultimoError = null;
  for (const modelo of MODELOS) {
    try {
      return await preguntarAlModelo(modelo, pregunta, llave);
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
  const pregunta = String(cuerpo.pregunta ?? '').trim().slice(0, 300);

  if (pregunta.length < 3) {
    res.status(400).json({ error: 'Falta la pregunta.' });
    return;
  }

  try {
    res.status(200).json({ consulta: await interpretar(pregunta) });
  } catch (error) {
    console.error('Error al interpretar la pregunta del portal:', error);
    res.status(502).json({ error: 'No se pudo interpretar la pregunta.' });
  }
};
