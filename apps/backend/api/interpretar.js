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
// Cadena de modelos (se prueba en orden hasta que uno conteste bien):
//   1. Google  gemini-3.5-flash-lite  → llave GOOGLE_API_KEY (medido: 1-2 s, 3 de 3 correctas;
//                                       cupo del plan gratuito: 15/min y 500/día por proyecto)
//   2. NVIDIA  nemotron-3.5-lightning → llave NVIDIA_API_KEY (la misma que usa el ETL)
//   3. NVIDIA  glm-5.3-flash
//   4. NVIDIA  laguna-xs-2.1
// El primer intento (Google) corta a los 20 s: no tiene sentido esperar 90 s al modelo rápido.
// Los de NVIDIA conservan los 90 s.
// ============================================================

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const GOOGLE_URL = (modelo) => `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

// Cadena de modelos: si uno falla o no responde bien, se prueba el siguiente.
// NVIDIA queda APAGADO momentaneamente (2026-10-01): sus modelos devolvian su razonamiento interno en
// ingles en el paso "respuesta". Para volver a encenderlo, cambiar USAR_NVIDIA a true (o poner false
// para apagarlo otra vez). La cadena y sus tiempos no cambian.
export const USAR_NVIDIA = false;

const CADENA_GOOGLE = [
  { proveedor: 'google', id: 'gemini-3.5-flash-lite' },
];

const CADENA_NVIDIA = [
  { proveedor: 'nvidia', id: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
  { proveedor: 'nvidia', id: 'z-ai/glm-5.3-flash' },
  { proveedor: 'nvidia', id: 'poolside/laguna-xs-2.1' },
];

export const MODELOS = CADENA_GOOGLE.concat(USAR_NVIDIA ? CADENA_NVIDIA : []);

/**
 * La cadena que se usa de verdad. NVIDIA esta apagado por defecto; con la variable de entorno
 * INTERPRETAR_USAR_NVIDIA=1 se enciende (y con 0 se apaga) sin tocar el codigo. Lo usan las pruebas
 * del respaldo entre modelos.
 */
export function cadenaDeModelos() {
  const puesto = process.env.INTERPRETAR_USAR_NVIDIA;
  const usarNvidia = puesto === '1' ? true : (puesto === '0' ? false : USAR_NVIDIA);
  return usarNvidia ? CADENA_GOOGLE.concat(CADENA_NVIDIA) : CADENA_GOOGLE;
}

const OPERACIONES = [
  'contar', 'porcentaje', 'cruce', 'listar', 'nps', 'satisfaccion', 'carreras', 'facultades', 'ciclos',
  'dimensiones', 'comentarios', 'temas', 'comparacion', 'fechas', 'periodos', 'ninguna',
];

const MAX_PREGUNTA = 300;
const MAX_CONTEXTO = 24000;
const MAX_MENU = 40000;
const MAX_BLOQUES = 20000;
const MAX_TOKENS = 500;
const MAX_TOKENS_RESPUESTA = 400;

// Si un modelo se queda colgado, no se le espera para siempre: se pasa al siguiente.
// (Configurables para poder probar el corte sin esperar de verdad.)
function tiempoLimite(proveedor) {
  const bruto = proveedor === 'google'
    ? (process.env.INTERPRETAR_TIMEOUT_GOOGLE_MS ?? process.env.INTERPRETAR_TIMEOUT_MS)
    : process.env.INTERPRETAR_TIMEOUT_MS;
  const valor = Number(bruto);
  if (Number.isFinite(valor) && valor > 0) return valor;
  return proveedor === 'google' ? 20000 : 90000;
}

const INSTRUCCIONES = `Eres el asistente de datos del portal de encuestas de la Universidad de Lima.
Recibes el contexto del proyecto (que puede traer una "Conversación reciente"), el menú de TODOS los períodos publicados (cada pregunta con sus opciones) y una pregunta.
Respondes SOLO un objeto JSON, sin texto alrededor, con esta forma exacta:
{"se_puede":true,"operacion":"...","periodo":"...","filtros":[{"pregunta":"...","valores":["..."]}],"pregunta_objetivo":"...","valores_objetivo":["..."],"entidad":"...","orden":"...","motivo":""}

- "se_puede" es false cuando la pregunta no se puede responder con los datos del menú (la hora, el clima, otro tema). En ese caso "motivo" lo explica en una frase corta.
- "operacion" es una de: ${OPERACIONES.join(' | ')}.
  - contar o porcentaje: cuántas respuestas cumplen los filtros (cuántos alumnos de tal carrera).
  - cruce: filtrar por una o más condiciones y contar una pregunta objetivo con sus valores (cuántos de tal grupo están satisfechos).
  - listar: cuando piden QUÉ valores hay de una pregunta ("qué carreras se encuestaron en 2025", "qué ciclos respondieron"): se pone esa pregunta en "pregunta_objetivo" y "valores_objetivo" con los valores pedidos (o vacío, que significa todos). No es un conteo del total.
  - nps, satisfaccion, carreras, facultades, ciclos, dimensiones, comentarios, temas, comparacion, fechas, periodos: como se usan hoy.
- "periodo": el nombre del período del menú al que te refieres, copiado tal cual; "" si no aplica.
- "filtros": lista de condiciones; cada una es una pregunta del menú con uno o más valores EXACTOS de esa pregunta.
- "pregunta_objetivo": la pregunta del menú que se quiere contar ("" si no se cuenta ninguna).
- "valores_objetivo": los valores EXACTOS que se quieren contar de la pregunta objetivo.
- "entidad": el nombre propio (carrera, facultad, ciclo o dimensión) cuando la operación lo usa; "" si no.
- "orden": "mejor" o "peor" cuando se piden los más altos o los más bajos; "" si no.

Reglas:
- Copia los nombres EXACTOS del menú; nunca inventes preguntas, valores ni períodos que no estén ahí.
- Cuando la pregunta pida cuantos/cuantas o un porcentaje de un grupo (los de tal carrera,
  los que trabajan...), separa: el GRUPO va en "filtros" y lo que se cuenta va en
  "pregunta_objetivo" con sus "valores_objetivo". Nunca pongas como filtro lo que se cuenta.
- Cada valor (en "filtros" y en "valores_objetivo") es una cadena copiada LITERALMENTE de las
  opciones de esa pregunta en el menú. Nunca pongas como valor el nombre o la explicación de una
  equivalencia: una equivalencia solo sirve para elegir las opciones del menú.
- Si la pregunta es un seguimiento ("y del 2025?", "y en Economía?", "y eso?"), complétala con la
  última pregunta y la respuesta que se dio en "Conversación reciente" antes de llenar el formulario.
- No escribes cifras ni respondes la pregunta: solo llenas el formulario.
- Si el menú no alcanza para responder, "se_puede" es false.`;

/**
 * Paso 1 — el PLAN. El modelo ya no elige una operación de un catálogo: dice qué datos hay que
 * leer (qué períodos, qué preguntas y qué filtros). El portal busca esos bloques en los JSON
 * publicados y se los devuelve en el paso 2.
 */
const INSTRUCCIONES_PLAN = `Eres el asistente de datos del portal de encuestas de la Universidad de Lima.
Recibes el contexto del proyecto (con la conversación reciente si la hay), el menú de TODOS los períodos publicados (cada pregunta con sus opciones) y una pregunta.
Dices QUÉ DATOS HAY QUE LEER para responderla. Respondes SOLO un objeto JSON, sin texto alrededor:
{"se_puede":true,"periodos":["..."],"preguntas":["..."],"filtros":[{"pregunta":"...","valores":["..."]}],"motivo":""}

- "periodos": los períodos del menú que hacen falta, copiados tal cual (uno o varios).
- "preguntas": las preguntas del menú cuyos datos hay que leer (por ejemplo "Carrera", "La carrera",
  "Situación laboral", "Tiempo laboral"). Es lo que se quiere saber, no lo que se filtra.
- "filtros": las condiciones que acotan la respuesta (una carrera, un ciclo, una situación laboral),
  cada una con una pregunta del menú y valores EXACTOS copiados de sus opciones.
- Regla general: las preguntas del menú tienen dos papeles. Unas son COLUMNAS por las que se agrupa o
  se filtra (por ejemplo la carrera que estudia la persona, el ciclo, la facultad); otras son
  PREGUNTAS que se miden (por ejemplo la satisfacción con algo, o la recomendación del 0 al 10).
  Cuando te pidan comparar ENTRE categorías (comparar carreras, comparar facultades, comparar
  ciclos, comparar períodos), se agrupa por la COLUMNA: esa columna va en "preguntas" (o en
  "filtros" si hay que acotar) y NO debes leer la pregunta de satisfacción que se llama parecido.
  No te niegues cuando pidan comparar: pide la columna y los datos de la medida.
- Si la pregunta es un seguimiento ("y del 2025?", "y de Psicología?"), complétala con la
  conversación reciente antes de decidir qué leer.
- **Nunca te niegues por ser la pregunta amplia, general, larga, de varios temas o conversacional.** Si el
  tema está en el menú, "se_puede" es true y pides todo lo que haga falta (varios períodos, varias preguntas):
  el paso de redacción, después, se encarga de resumirlo. Que una pregunta sea amplia NO es motivo para negarse.
- Los dos ÚNICOS motivos para "se_puede": false son que el tema no esté en las encuestas (la hora, el clima,
  otra universidad, una opinión o un pronóstico) o que la pregunta no sea sobre las encuestas; "motivo" lo
  explica en una frase corta, sin hablar de alcance, de tipos de consulta ni de reglas.
- Si la pregunta es un seguimiento sobre lo que se acaba de responder ("¿no recuerdas la conversación?", "y
  eso?"), contéstala con la conversación reciente: no la clasifiques ni digas que "no requiere consultar los
  datos".
- Copia los nombres EXACTOS del menú; nunca inventes períodos, preguntas ni valores. No escribas cifras.`;

/**
 * Paso 2 — la REDACCIÓN. Recibe la pregunta y los datos que el portal encontró, y escribe la
 * respuesta con ellos; cada cifra que escriba tiene que estar en los datos (el portal lo comprueba).
 */
export const INSTRUCCIONES_RESPUESTA = `Eres el asistente de datos del portal de encuestas de la Universidad de Lima.
Recibes una pregunta y los DATOS PUBLICADOS que le corresponden (los buscó el portal).
Respondes en español, claro y breve (una a cuatro frases), usando SOLO esos datos.
- Cada cifra que escribas tiene que aparecer tal cual en los datos; no calcules ni supongas.
- Si los datos no alcanzan, dilo en una frase corta ("con los datos publicados no puedo responder eso") en vez
  de inventar. Nunca hables del alcance, del tipo de consulta ni de reglas internas ("excede el alcance de una
  sola consulta", "es de tipo conversacional"): eso no existe para la persona que pregunta.
- **Puedes hacer cuentas con las cifras que están en los datos: sumar, restar, multiplicar, dividir y contar.**
  La regla es una sola: cada número que uses tiene que estar publicado; el resultado de la cuenta es tuyo, pero no
  puede aparecer una cifra que no venga de los datos ni de una cuenta entre ellos.
- Cuando la pregunta compara o pide un total, arma la respuesta con esas cuentas y di cuál es mayor o menor: no
  repitas la lista entera.
- **Cómo se escriben los números (regla del proyecto, sin excepciones):** enteros sin separador de miles (4239,
  no 4.239 ni 4,239); decimales con coma (72,61, no 72.61); porcentajes con coma, dos decimales cuando hagan
  falta y espacio antes del signo (97,85 %, 100 %); nada de notación científica ni de números en inglés.
- **Si la pregunta pide comparar o resumir varias filas** (todas las carreras o facultades, todos los ciclos, dos
  períodos), NO te niegues por ser amplia: con los datos que tienes, di lo que muestran (las que más subieron y
  las que más bajaron, la más alta y la más baja, el rango) con sus cifras. Nunca respondas que la pregunta es
  "demasiado amplia", "general" o "excede el alcance": eso no existe.
- No repitas la pregunta ni expliques el proceso.
- **Escribe SOLO la respuesta, en espanol, y empieza directo con ella.** No escribas tu razonamiento (nada de
  "thinking process", "analyze", pasos numerados, títulos ni notas de como vas a responder) y no escribas nada
  en ingles. Si el texto empieza contando como analizaste la pregunta o las reglas, esta mal: borralo y empieza
  con la respuesta.
- Cuando una tabla ayude a entender mejor la respuesta (comparar categorías, ordenar valores, mostrar varios
  datos de una misma cosa), agrega al final una tabla, después del texto y antes de la línea de la fuente, así:
    Tabla: <título de la columna 1> | <título de la columna 2>
    <celda> | <celda>
    <celda> | <celda>
  Separa las celdas con " | " (espacio, barra, espacio), una fila por línea, sin líneas de guiones, y todas
  las filas con la misma cantidad de celdas que el encabezado.
  Prefiere POCAS columnas y muchas filas: que la tabla se lea sin arrastrarla de lado (casi siempre bastan dos
  columnas, y tres si comparas períodos). No la uses para una sola fila ni para repetir lo que ya dice el texto.
  El criterio es uno: la tabla se usa si mejora el entendimiento de la respuesta; si no aporta, va solo el texto.
  Las cifras de la tabla se copian tal como vienen en los datos, con el mismo formato de números que ya exige
  este texto (nada de redondear ni reacomodar los decimales).
  Las columnas también salen de los datos: no inventes columnas ni metas dos datos en una misma celda.
  Si la tabla lista categorías, van TODAS las que estén en los datos: no se omite ninguna
  (carreras, facultades, ciclos, dimensiones y períodos). Si son muchísimas (más de veinte), dilo en el
  texto y pon en la tabla las más relevantes, avisando cuáles quedaron fuera.
- En la última línea, aparte, escribe de dónde sale: "Fuente: " y el período o la encuesta que figuren en los datos.`;

/** La instrucción que corresponde a cada paso. */
function instruccionesDe(paso) {
  if (paso === 'plan') return INSTRUCCIONES_PLAN;
  if (paso === 'respuesta') return INSTRUCCIONES_RESPUESTA;
  return INSTRUCCIONES;
}

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

/** El plan de lectura (paso 1): qué períodos, qué preguntas y qué filtros hacen falta. */
export function normalizarPlan(crudo) {
  if (!crudo || typeof crudo !== 'object') return null;
  return {
    se_puede: crudo.se_puede !== false,
    periodos: (Array.isArray(crudo.periodos) ? crudo.periodos : [])
      .slice(0, 3).map((p) => limpiarTexto(p, 60)).filter(Boolean),
    preguntas: (Array.isArray(crudo.preguntas) ? crudo.preguntas : [])
      .slice(0, 6).map((p) => limpiarTexto(p, 80)).filter(Boolean),
    filtros: (Array.isArray(crudo.filtros) ? crudo.filtros : [])
      .slice(0, 4)
      .map((f) => ({
        pregunta: limpiarTexto(f?.pregunta, 80),
        valores: (Array.isArray(f?.valores) ? f.valores : []).slice(0, 12).map((v) => limpiarTexto(v, 80)).filter(Boolean),
      }))
      .filter((f) => f.pregunta && f.valores.length),
    motivo: limpiarTexto(crudo.motivo, 200),
  };
}

/** La respuesta redactada (paso 2): texto plano, sin bloques de código y con un tope de largo. */
export function limpiarRespuesta(texto) {
  return String(texto ?? '')
    .replace(/```+/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .trim()
    .slice(0, 1200);
}

/** El mensaje del usuario: contexto + menú + (datos, en el paso de redacción) + la pregunta. */
export function armarMensaje(pregunta, contexto, menu, bloques) {
  return [
    limpiarTexto(contexto, MAX_CONTEXTO),
    limpiarTexto(menu, MAX_MENU),
    limpiarTexto(bloques, MAX_BLOQUES),
    '## Pregunta\n' + pregunta,
  ].filter(Boolean).join('\n\n');
}

/**
 * Cuerpo de la petición para Google (generateContent).
 * Aquí SÍ se manda "temperature": 0 (a diferencia del análisis cualitativo del ETL, que la
 * omite): esta tarea consiste en extraer nombres exactos de una lista, no en redactar.
 */
export function cuerpoGoogle(pregunta, contexto, menu, paso = 'formulario', bloques = '') {
  return {
    systemInstruction: { parts: [{ text: instruccionesDe(paso) }] },
    contents: [{ role: 'user', parts: [{ text: armarMensaje(pregunta, contexto, menu, bloques) }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: paso === 'respuesta' ? MAX_TOKENS_RESPUESTA : MAX_TOKENS,
    },
  };
}

/** Cuerpo de la petición para NVIDIA (formato OpenAI). */
export function cuerpoNvidia(modelo, pregunta, contexto, menu, paso = 'formulario', bloques = '') {
  return {
    model: modelo,
    messages: [
      { role: 'system', content: instruccionesDe(paso) },
      { role: 'user', content: armarMensaje(pregunta, contexto, menu, bloques) },
    ],
    temperature: 0,
    max_tokens: paso === 'respuesta' ? MAX_TOKENS_RESPUESTA : MAX_TOKENS,
  };
}

/** Texto del modelo, según el proveedor (cada uno devuelve la respuesta a su manera). */
export function textoDeRespuesta(proveedor, datos) {
  if (proveedor === 'google') {
    const partes = datos?.candidates?.[0]?.content?.parts ?? [];
    return partes.map((p) => p?.text ?? '').join('');
  }
  return datos?.choices?.[0]?.message?.content ?? '';
}

export async function llamarAlModelo(modelo, pregunta, contexto, menu, llave, paso = 'formulario', bloques = '') {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), tiempoLimite(modelo.proveedor));
  const etiqueta = `${modelo.proveedor}:${modelo.id}`;
  let respuesta;
  try {
    if (modelo.proveedor === 'google') {
      respuesta = await fetch(`${GOOGLE_URL(modelo.id)}?key=${encodeURIComponent(llave)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpoGoogle(pregunta, contexto, menu, paso, bloques)),
        signal: control.signal,
      });
    } else {
      respuesta = await fetch(NVIDIA_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + llave,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cuerpoNvidia(modelo.id, pregunta, contexto, menu, paso, bloques)),
        signal: control.signal,
      });
    }
  } finally {
    clearTimeout(reloj);
  }

  if (!respuesta.ok) {
    throw new Error(`${etiqueta}: ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  const texto = textoDeRespuesta(modelo.proveedor, datos);
  // El paso de redacción devuelve texto; los otros dos, un objeto JSON.
  if (paso === 'respuesta') {
    const escrito = limpiarRespuesta(texto);
    if (!escrito) throw new Error(`${etiqueta}: respuesta vacía`);
    return { respuesta: escrito };
  }
  const salida = paso === 'plan' ? normalizarPlan(primerObjeto(texto)) : normalizarConsulta(primerObjeto(texto));
  if (!salida) {
    throw new Error(`${etiqueta}: respuesta no interpretable`);
  }
  return salida;
}

async function interpretar(pregunta, contexto, menu, paso = 'formulario', bloques = '') {
  let ultimoError = null;
  for (const modelo of cadenaDeModelos()) {
    const llave = modelo.proveedor === 'google' ? process.env.GOOGLE_API_KEY : process.env.NVIDIA_API_KEY;
    if (!llave) {
      ultimoError = new Error(`Falta la llave ${modelo.proveedor === 'google' ? 'GOOGLE_API_KEY' : 'NVIDIA_API_KEY'} en el servidor.`);
      continue;
    }
    try {
      return await llamarAlModelo(modelo, pregunta, contexto, menu, llave, paso, bloques);
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
  const pasos = ['plan', 'respuesta', 'formulario'];
  const paso = pasos.includes(cuerpo.paso) ? cuerpo.paso : 'formulario';

  if (pregunta.length < 3) {
    res.status(400).json({ error: 'Falta la pregunta.' });
    return;
  }

  try {
    const salida = await interpretar(pregunta, cuerpo.contexto, cuerpo.menu, paso, cuerpo.bloques);
    if (paso === 'respuesta') res.status(200).json({ respuesta: salida.respuesta });
    else if (paso === 'plan') res.status(200).json({ plan: salida });
    else res.status(200).json({ consulta: salida });
  } catch (error) {
    console.error('Error al interpretar la pregunta del portal:', error);
    res.status(502).json({ error: 'No se pudo interpretar la pregunta.' });
  }
};
