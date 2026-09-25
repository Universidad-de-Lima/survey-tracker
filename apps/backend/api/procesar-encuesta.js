/**
 * Pide a GitHub que ejecute el proceso que convierte las respuestas acumuladas de
 * Zoho Survey (repositorio `survey-test`) en los datos publicados del portal.
 *
 * Lo llama el botón de refrescar del portal. La llave de GitHub vive SOLO aquí, en la
 * variable de entorno `GITHUB_DISPATCH_TOKEN` de Vercel: el navegador nunca la ve, así
 * que no hay nada que pegar en la página ni que se pueda filtrar desde ella.
 *
 * Permiso que necesita la llave: en `survey-test`, **Contents: Read and write**
 * (es lo que exige `POST /repos/{owner}/{repo}/dispatches`) y **Contents: Read**
 * para leer el historial de commits, con el que se evita disparar cuando no hay
 * respuestas nuevas. Si además se le da **Actions: Read-only**, el endpoint puede
 * evitar disparos repetidos.
 */

const REPOSITORIO = 'Universidad-de-Lima/survey-test';
const EVENTO = 'procesar_datos';
const FLUJO = 'build_zoho_survey.yml';
const API = 'https://api.github.com';

// Rutas que se comparan para saber si hay trabajo pendiente: las bandejas que
// llena el webhook y los datos que genera el proceso.
const RUTA_BANDEJAS = 'data/zoho_pendientes';
const RUTA_DATOS = 'zoho-survey/students';

// El portal se sirve desde GitHub Pages; localhost queda para pruebas manuales.
const ORIGENES_PERMITIDOS = ['https://universidad-de-lima.github.io', 'http://localhost:3000'];

// Ventana de cortesía: evita disparos repetidos por clics seguidos o por dos personas
// pulsando a la vez. No es seguridad (la llave no está expuesta), es higiene.
const MINUTOS_DE_ESPERA = 10;

function aplicarCors(req, res) {
  const origen = (req.headers && (req.headers.origin || req.headers.Origin)) || '';
  if (ORIGENES_PERMITIDOS.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function cabeceras(llave) {
  return {
    Authorization: `Bearer ${llave}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'survey-tracker-backend',
  };
}

/**
 * Última ejecución del flujo, si se puede consultar. Sin permiso de lectura de
 * Actions (o si GitHub falla) devuelve null y el endpoint sigue funcionando.
 */
async function ultimaEjecucion(llave) {
  try {
    const respuesta = await fetch(
      `${API}/repos/${REPOSITORIO}/actions/workflows/${FLUJO}/runs?per_page=1`,
      { headers: cabeceras(llave) },
    );
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    const corrida = datos && Array.isArray(datos.workflow_runs) ? datos.workflow_runs[0] : null;
    return corrida ? { creada: corrida.created_at, estado: corrida.status } : null;
  } catch {
    return null;
  }
}

/**
 * Fecha (ISO) del último commit que tocó una ruta, o null si no se pudo saber.
 */
async function ultimoMovimiento(llave, ruta) {
  try {
    const respuesta = await fetch(
      `${API}/repos/${REPOSITORIO}/commits?path=${encodeURIComponent(ruta)}&per_page=1`,
      { headers: cabeceras(llave) },
    );
    if (!respuesta.ok) return null;
    const commits = await respuesta.json();
    if (!Array.isArray(commits) || commits.length === 0) return null;
    const commit = commits[0].commit || {};
    const autor = commit.committer || commit.author || {};
    return autor.date || null;
  } catch {
    return null;
  }
}

/**
 * ¿Llegaron respuestas después de la última generación?
 * true = hay trabajo, false = no cambió nada, null = no se pudo averiguar
 * (en ese caso se dispara igual, como antes de existir esta comprobación).
 */
async function hayRespuestasNuevas(llave) {
  const [bandejas, generados] = await Promise.all([
    ultimoMovimiento(llave, RUTA_BANDEJAS),
    ultimoMovimiento(llave, RUTA_DATOS),
  ]);
  if (!bandejas) return null;
  if (!generados) return true;
  return Date.parse(bandejas) > Date.parse(generados);
}

function minutosDesde(iso) {
  const marca = Date.parse(iso);
  if (Number.isNaN(marca)) return Infinity;
  return (Date.now() - marca) / 60000;
}

export default async (req, res) => {
  aplicarCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const llave = process.env.GITHUB_DISPATCH_TOKEN;
  if (!llave) {
    res.status(503).json({ error: 'Falta configurar GITHUB_DISPATCH_TOKEN en Vercel.' });
    return;
  }

  try {
    const anterior = await ultimaEjecucion(llave);
    if (anterior && minutosDesde(anterior.creada) < MINUTOS_DE_ESPERA) {
      res.status(200).json({
        message: 'Ya hay una ejecución en curso o recién terminada. Prueba en unos minutos.',
        ultima: anterior.creada,
      });
      return;
    }

    // Nada nuevo que procesar: se corta aquí y no se gasta una corrida del ETL
    // (que tarda entre 2 y 25 minutos según haya que analizar comentarios).
    const hayNuevas = await hayRespuestasNuevas(llave);
    if (hayNuevas === false) {
      res.status(200).json({
        message: 'Sin cambios: no hay respuestas nuevas desde la última actualización.',
      });
      return;
    }

    const respuesta = await fetch(`${API}/repos/${REPOSITORIO}/dispatches`, {
      method: 'POST',
      headers: cabeceras(llave),
      body: JSON.stringify({ event_type: EVENTO }),
    });

    if (respuesta.status !== 204) {
      const detalle = await respuesta.text();
      console.error('GitHub rechazó el disparo:', respuesta.status, detalle.slice(0, 300));
      res.status(502).json({ error: 'GitHub rechazó la solicitud.', status: respuesta.status });
      return;
    }

    console.log(`Proceso solicitado en ${REPOSITORIO} (evento ${EVENTO}).`);
    res.status(202).json({ message: 'Proceso solicitado. Los datos se actualizarán en unos minutos.' });
  } catch (error) {
    console.error('Error al solicitar el proceso:', error);
    res.status(500).json({ error: 'Error interno del servidor al solicitar el proceso.' });
  }
};
